import { destroyAnime4kPipelineResources } from "./gpu-resources.js";
import {
  INPUT_TRANSFER_SAMPLE_POINTS,
  areDirectTransferSamplesValid
} from "./input-transfer.js";
import { getWebGpuDevice } from "./webgpu-device.js";

const VERTEX_SHADER = /* wgsl */ `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn main(@builtin(vertex_index) index: u32) -> VertexOutput {
  const positions = array(
    vec2f( 1.0,  1.0), vec2f( 1.0, -1.0), vec2f(-1.0, -1.0),
    vec2f( 1.0,  1.0), vec2f(-1.0, -1.0), vec2f(-1.0,  1.0)
  );
  const coordinates = array(
    vec2f(1.0, 0.0), vec2f(1.0, 1.0), vec2f(0.0, 1.0),
    vec2f(1.0, 0.0), vec2f(0.0, 1.0), vec2f(0.0, 0.0)
  );

  var output: VertexOutput;
  output.position = vec4f(positions[index], 0.0, 1.0);
  output.uv = coordinates[index];
  return output;
}
`;

const FRAGMENT_SHADER = /* wgsl */ `
@group(0) @binding(0) var sourceSampler: sampler;
@group(0) @binding(1) var sourceTexture: texture_2d<f32>;

struct DisplaySettings {
  colorRangeMode: u32,
}
@group(0) @binding(2) var<uniform> displaySettings: DisplaySettings;

@fragment
fn main(@location(0) uv: vec2f) -> @location(0) vec4f {
  var color = textureSampleBaseClampToEdge(sourceTexture, sourceSampler, uv);
  if (displaySettings.colorRangeMode == 1u) {
    // 8-bit limited range (16-235) to full range (0-255)
    color = vec4f(clamp((color.rgb - vec3f(16.0 / 255.0)) * (255.0 / 219.0), vec3f(0.0), vec3f(1.0)), color.a);
  } else if (displaySettings.colorRangeMode == 2u) {
    // 8-bit full range (0-255) to limited range (16-235)
    color = vec4f(clamp(color.rgb * (219.0 / 255.0) + vec3f(16.0 / 255.0), vec3f(0.0), vec3f(1.0)), color.a);
  }
  return color;
}
`;

const COLOR_RANGE_MODE_VALUES = {
  none: 0,
  "limited-to-full": 1,
  "full-to-limited": 2
};
const MAX_INPUT_FRAME_DRIFT_SECONDS = 0.1;
const FRAME_STATS_INTERVAL_MILLISECONDS = 1000;

async function validateDirectVideoTransfer(device, video, inputTexture, bridgeContext) {
  const buffers = [];
  let errorScopeActive = false;
  try {
    bridgeContext.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
    const referenceSamples = INPUT_TRANSFER_SAMPLE_POINTS.map(([xRatio, yRatio]) => (
      Array.from(bridgeContext.getImageData(
        Math.floor(video.videoWidth * xRatio),
        Math.floor(video.videoHeight * yRatio),
        1,
        1
      ).data)
    ));

    device.pushErrorScope("validation");
    errorScopeActive = true;
    device.queue.copyExternalImageToTexture(
      { source: video },
      { texture: inputTexture, colorSpace: "srgb" },
      [video.videoWidth, video.videoHeight]
    );
    const encoder = device.createCommandEncoder();
    for (const [xRatio, yRatio] of INPUT_TRANSFER_SAMPLE_POINTS) {
      const buffer = device.createBuffer({
        size: 256,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
      });
      buffers.push(buffer);
      encoder.copyTextureToBuffer(
        {
          texture: inputTexture,
          origin: {
            x: Math.floor(video.videoWidth * xRatio),
            y: Math.floor(video.videoHeight * yRatio)
          }
        },
        { buffer, bytesPerRow: 256 },
        { width: 1, height: 1 }
      );
    }
    device.queue.submit([encoder.finish()]);
    const validationResult = device.popErrorScope();
    errorScopeActive = false;
    const validationError = await validationResult;
    if (validationError) return { supported: false, referenceSamples };

    await Promise.all(buffers.map((buffer) => buffer.mapAsync(GPUMapMode.READ)));
    const directSamples = buffers.map((buffer) => (
      Array.from(new Uint8Array(buffer.getMappedRange(), 0, 4))
    ));
    return {
      supported: areDirectTransferSamplesValid(referenceSamples, directSamples),
      referenceSamples
    };
  } catch {
    return { supported: false, referenceSamples: [] };
  } finally {
    if (errorScopeActive) await device.popErrorScope().catch(() => {});
    for (const buffer of buffers) {
      try { buffer.unmap(); } catch {}
      buffer.destroy();
    }
  }
}

function waitForVideoData(video) {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const onLoadedData = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(video.error || new Error("動画データを読み込めませんでした"));
    };
    const cleanup = () => {
      video.removeEventListener("loadeddata", onLoadedData);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("loadeddata", onLoadedData, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

export async function render({
  video,
  canvas,
  colorRangeMode,
  pipelineBuilder,
  onRuntimeError,
  onInputSample,
  onGpuInputSample,
  onGpuOutputSample,
  onFrameStats
}) {
  await waitForVideoData(video);

  const device = await getWebGpuDevice();
  const context = canvas.getContext("webgpu");
  if (!context) throw new Error("WebGPU Canvasコンテキストを取得できませんでした");

  const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format: canvasFormat,
    alphaMode: "opaque",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
  });

  let inputTexture;
  let bridgeCanvas;
  let bridgeContext;
  let pipelines = [];
  let renderPipeline;
  let displaySettingsBuffer;
  let bindGroup;
  let useDirectVideoTransfer = false;
  let initialInputSampleReported = false;
  let resourcesReleased = false;
  const releaseResources = () => {
    if (resourcesReleased) return;
    resourcesReleased = true;
    destroyAnime4kPipelineResources(pipelines, [inputTexture]);
    inputTexture?.destroy();
    displaySettingsBuffer?.destroy();
    context.unconfigure?.();
    if (bridgeCanvas) {
      bridgeCanvas.width = 1;
      bridgeCanvas.height = 1;
    }
  };

  try {
    // 動画からfloat16へ直接コピーすると一部のChrome/ANGLE環境で黒くなるため、
    // WebGPUの標準的な8-bit正規化テクスチャを入力として使用する。
    inputTexture = device.createTexture({
      label: "YouTube video input (rgba8unorm)",
      size: [video.videoWidth, video.videoHeight, 1],
      format: "rgba8unorm",
      usage: GPUTextureUsage.COPY_SRC
        | GPUTextureUsage.COPY_DST
        | GPUTextureUsage.TEXTURE_BINDING
        | GPUTextureUsage.RENDER_ATTACHMENT
    });
    bridgeCanvas = new OffscreenCanvas(video.videoWidth, video.videoHeight);
    bridgeContext = bridgeCanvas.getContext("2d", {
      alpha: false,
      desynchronized: true,
      willReadFrequently: Boolean(onInputSample)
    });
    if (!bridgeContext) {
      throw new Error("動画転送用の2D Canvasコンテキストを取得できませんでした");
    }
    const transferValidation = await validateDirectVideoTransfer(
      device,
      video,
      inputTexture,
      bridgeContext
    );
    useDirectVideoTransfer = transferValidation.supported;
    if (onInputSample && transferValidation.referenceSamples.length > 0) {
      onInputSample(transferValidation.referenceSamples.map((rgba, index) => ({
        position: INPUT_TRANSFER_SAMPLE_POINTS[index].join(","),
        rgba
      })));
      initialInputSampleReported = true;
    }
    pipelines = pipelineBuilder(device, inputTexture);
    const outputTexture = pipelines.at(-1)?.getOutputTexture();
    if (!outputTexture) throw new Error("フィルター出力テクスチャを取得できませんでした");

    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } }
      ]
    });
    renderPipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
      vertex: {
        module: device.createShaderModule({ code: VERTEX_SHADER }),
        entryPoint: "main"
      },
      fragment: {
        module: device.createShaderModule({ code: FRAGMENT_SHADER }),
        entryPoint: "main",
        targets: [{ format: canvasFormat }]
      },
      primitive: { topology: "triangle-list" }
    });
    displaySettingsBuffer = device.createBuffer({
      label: "YouTube Video Filter display settings",
      size: 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Uint32Array(displaySettingsBuffer.getMappedRange())[0] = COLOR_RANGE_MODE_VALUES[colorRangeMode] ?? 0;
    displaySettingsBuffer.unmap();
    bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: device.createSampler({ magFilter: "linear", minFilter: "linear" })
        },
        { binding: 1, resource: outputTexture.createView() },
        { binding: 2, resource: { buffer: displaySettingsBuffer } }
      ]
    });
  } catch (error) {
    releaseResources();
    throw error;
  }

  let stopped = false;
  let inputSampleReported = initialInputSampleReported;
  let gpuInputSampleReported = false;
  let gpuOutputSampleReported = false;
  let frameRequestId;
  let frameInFlight = false;
  let receivedFrames = 0;
  let submittedFrames = 0;
  let completedFrames = 0;
  let droppedFrames = 0;
  let staleFrames = 0;
  let lastReportedReceivedFrames = 0;
  let lastReportedCompletedFrames = 0;
  let lastReportedDroppedFrames = 0;
  let lastReportedStaleFrames = 0;
  let lastStatsTime = performance.now();
  let firstFrameSettled = false;
  let resolveFirstFrame;
  let rejectFirstFrame;
  const firstFrameTimeoutId = setTimeout(() => {
    if (firstFrameSettled) return;
    firstFrameSettled = true;
    stopped = true;
    if (frameRequestId !== undefined) video.cancelVideoFrameCallback(frameRequestId);
    rejectFirstFrame(new Error("5000ms以内に最初のWebGPUフレームを描画できませんでした"));
  }, 5000);
  const firstFrame = new Promise((resolve, reject) => {
    resolveFirstFrame = resolve;
    rejectFirstFrame = reject;
  });

  const fail = (error) => {
    if (stopped) return;
    if (!firstFrameSettled) {
      firstFrameSettled = true;
      clearTimeout(firstFrameTimeoutId);
      rejectFirstFrame(error);
    } else {
      onRuntimeError?.(error);
    }
  };

  const maybeReportFrameStats = (now, metadata) => {
    if (!onFrameStats || now - lastStatsTime < FRAME_STATS_INTERVAL_MILLISECONDS) return;
    const elapsedSeconds = Math.max((now - lastStatsTime) / 1000, 0.001);
    const intervalReceivedFrames = receivedFrames - lastReportedReceivedFrames;
    const intervalCompletedFrames = completedFrames - lastReportedCompletedFrames;
    const intervalDroppedFrames = droppedFrames - lastReportedDroppedFrames;
    const intervalStaleFrames = staleFrames - lastReportedStaleFrames;
    const intervalDiscardedFrames = intervalDroppedFrames + intervalStaleFrames;
    onFrameStats({
      receivedFrames,
      submittedFrames,
      completedFrames,
      droppedFrames,
      staleFrames,
      dropRate: Number((((droppedFrames + staleFrames) / Math.max(receivedFrames, 1)) * 100).toFixed(1)),
      approximateInputFps: Number((intervalReceivedFrames / elapsedSeconds).toFixed(1)),
      approximateOutputFps: Number((intervalCompletedFrames / elapsedSeconds).toFixed(1)),
      intervalReceivedFrames,
      intervalCompletedFrames,
      intervalDroppedFrames,
      intervalStaleFrames,
      intervalDropRate: Number(((intervalDiscardedFrames / Math.max(intervalReceivedFrames, 1)) * 100).toFixed(1)),
      mediaTime: Number(metadata.mediaTime.toFixed(3)),
      currentTime: Number(video.currentTime.toFixed(3)),
      synchronizationOffsetMs: Number(((metadata.mediaTime - video.currentTime) * 1000).toFixed(1))
    });
    lastReportedReceivedFrames = receivedFrames;
    lastReportedCompletedFrames = completedFrames;
    lastReportedDroppedFrames = droppedFrames;
    lastReportedStaleFrames = staleFrames;
    lastStatsTime = now;
  };

  const drawFrame = (now, metadata) => {
    if (stopped || !video.isConnected) return;
    // GPU処理中も動画フレームの通知は監視し続ける。完了後に次に届く
    // 最新フレームを処理し、中間フレームを待機キューへ積まない。
    frameRequestId = video.requestVideoFrameCallback(drawFrame);
    receivedFrames += 1;

    if (frameInFlight) {
      droppedFrames += 1;
      maybeReportFrameStats(now, metadata);
      return;
    }

    const synchronizationOffset = metadata.mediaTime - video.currentTime;
    if (Math.abs(synchronizationOffset) > MAX_INPUT_FRAME_DRIFT_SECONDS) {
      staleFrames += 1;
      maybeReportFrameStats(now, metadata);
      return;
    }

    frameInFlight = true;
    let frameBitmap;

    try {
      // HTMLVideoElementからWebGPUへ直接コピーすると、Chrome/ANGLEの動画デコード
      // 経路によっては検証エラーなしで黒い画素が返る。2D Canvasを中継して
      // デコーダー固有の内部表現をRGBAへ確実に変換する。
      let bridgeFramePrepared = false;
      if (!useDirectVideoTransfer) {
        bridgeContext.drawImage(
          video,
          0,
          0,
          video.videoWidth,
          video.videoHeight
        );
        bridgeFramePrepared = true;
      }
      if (!useDirectVideoTransfer && !inputSampleReported && onInputSample) {
        inputSampleReported = true;
        const samplePoints = [
          [0.25, 0.25],
          [0.5, 0.5],
          [0.75, 0.75]
        ];
        const samples = samplePoints.map(([xRatio, yRatio]) => ({
          position: `${xRatio},${yRatio}`,
          rgba: Array.from(bridgeContext.getImageData(
            Math.floor(video.videoWidth * xRatio),
            Math.floor(video.videoHeight * yRatio),
            1,
            1
          ).data)
        }));
        onInputSample(samples);
      }
      inputSampleReported = true;
      if (useDirectVideoTransfer) {
        try {
          device.queue.copyExternalImageToTexture(
            { source: video },
            { texture: inputTexture, colorSpace: "srgb" },
            [video.videoWidth, video.videoHeight]
          );
        } catch {
          useDirectVideoTransfer = false;
        }
      }
      if (!useDirectVideoTransfer) {
        if (!bridgeFramePrepared) {
          bridgeContext.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        }
        frameBitmap = bridgeCanvas.transferToImageBitmap();
        device.queue.copyExternalImageToTexture(
          { source: frameBitmap },
          { texture: inputTexture, colorSpace: "srgb" },
          [video.videoWidth, video.videoHeight]
        );
      }

      const encoder = device.createCommandEncoder();
      for (const pipeline of pipelines) pipeline.pass(encoder);

      const presentationTexture = context.getCurrentTexture();
      const renderPass = encoder.beginRenderPass({
        colorAttachments: [{
          view: presentationTexture.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store"
        }]
      });
      renderPass.setPipeline(renderPipeline);
      renderPass.setBindGroup(0, bindGroup);
      renderPass.draw(6);
      renderPass.end();

      let outputReadbackBuffer;
      if (!gpuOutputSampleReported && onGpuOutputSample) {
        gpuOutputSampleReported = true;
        outputReadbackBuffer = device.createBuffer({
          size: 256,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        encoder.copyTextureToBuffer(
          {
            texture: presentationTexture,
            origin: {
              x: Math.floor(canvas.width / 2),
              y: Math.floor(canvas.height / 2)
            }
          },
          { buffer: outputReadbackBuffer, bytesPerRow: 256 },
          { width: 1, height: 1 }
        );
      }

      let inputReadbackBuffer;
      if (!gpuInputSampleReported && onGpuInputSample) {
        gpuInputSampleReported = true;
        inputReadbackBuffer = device.createBuffer({
          size: 256,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        encoder.copyTextureToBuffer(
          {
            texture: inputTexture,
            origin: {
              x: Math.floor(video.videoWidth / 2),
              y: Math.floor(video.videoHeight / 2)
            }
          },
          { buffer: inputReadbackBuffer, bytesPerRow: 256 },
          { width: 1, height: 1 }
        );
      }
      device.queue.submit([encoder.finish()]);
      submittedFrames += 1;

      if (outputReadbackBuffer) {
        outputReadbackBuffer.mapAsync(GPUMapMode.READ).then(() => {
          if (stopped) {
            outputReadbackBuffer.destroy();
            return;
          }
          const rgba = Array.from(new Uint8Array(outputReadbackBuffer.getMappedRange(), 0, 4));
          onGpuOutputSample(rgba);
          outputReadbackBuffer.unmap();
          outputReadbackBuffer.destroy();
        }, (error) => {
          outputReadbackBuffer.destroy();
          if (!stopped) onRuntimeError?.(error);
        });
      }

      if (inputReadbackBuffer) {
        inputReadbackBuffer.mapAsync(GPUMapMode.READ).then(() => {
          if (stopped) {
            inputReadbackBuffer.destroy();
            return;
          }
          const rgba = Array.from(new Uint8Array(inputReadbackBuffer.getMappedRange(), 0, 4));
          onGpuInputSample(rgba);
          inputReadbackBuffer.unmap();
          inputReadbackBuffer.destroy();
        }, (error) => {
          inputReadbackBuffer.destroy();
          if (!stopped) onRuntimeError?.(error);
        });
      }

      // Dawnが外部画像コピーを遅延実行する可能性があるため、GPU完了まで
      // ImageBitmapを生存させる。完了待ちをフレーム受付のゲートとしても使い、
      // 過負荷時に古いフレームがGPUキューへ蓄積することを防ぐ。
      device.queue.onSubmittedWorkDone().then(() => {
        frameBitmap?.close();
        frameInFlight = false;
        if (stopped) return;
        completedFrames += 1;
        if (!firstFrameSettled) {
          firstFrameSettled = true;
          clearTimeout(firstFrameTimeoutId);
          resolveFirstFrame();
        }
      }, (error) => {
        frameBitmap?.close();
        frameInFlight = false;
        fail(error);
      });
    } catch (error) {
      frameBitmap?.close();
      frameInFlight = false;
      fail(error);
    }
    maybeReportFrameStats(now, metadata);
  };

  frameRequestId = video.requestVideoFrameCallback(drawFrame);
  try {
    await firstFrame;
  } catch (error) {
    releaseResources();
    throw error;
  }

  return {
    device,
    inputFormat: "rgba8unorm",
    inputTransfer: useDirectVideoTransfer
      ? "direct-video-validated"
      : "2d-canvas-to-image-bitmap",
    updateColorRangeMode(nextColorRangeMode) {
      if (stopped || resourcesReleased) return false;
      try {
        device.queue.writeBuffer(
          displaySettingsBuffer,
          0,
          new Uint32Array([COLOR_RANGE_MODE_VALUES[nextColorRangeMode] ?? 0])
        );
        return true;
      } catch {
        return false;
      }
    },
    stop() {
      stopped = true;
      if (frameRequestId !== undefined) video.cancelVideoFrameCallback(frameRequestId);
      releaseResources();
    }
  };
}
