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
  onGpuOutputSample
}) {
  await waitForVideoData(video);

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("WebGPUアダプターを取得できませんでした");

  const device = await adapter.requestDevice();
  const context = canvas.getContext("webgpu");
  if (!context) throw new Error("WebGPU Canvasコンテキストを取得できませんでした");

  const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format: canvasFormat,
    alphaMode: "opaque",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
  });

  // 動画からfloat16へ直接コピーすると一部のChrome/ANGLE環境で黒くなるため、
  // WebGPUの標準的な8-bit正規化テクスチャを入力として使用する。
  const inputTexture = device.createTexture({
    label: "YouTube video input (rgba8unorm)",
    size: [video.videoWidth, video.videoHeight, 1],
    format: "rgba8unorm",
    usage: GPUTextureUsage.COPY_SRC
      | GPUTextureUsage.COPY_DST
      | GPUTextureUsage.TEXTURE_BINDING
      | GPUTextureUsage.RENDER_ATTACHMENT
  });
  const bridgeCanvas = new OffscreenCanvas(video.videoWidth, video.videoHeight);
  const bridgeContext = bridgeCanvas.getContext("2d", {
    alpha: false,
    desynchronized: true,
    willReadFrequently: Boolean(onInputSample)
  });
  if (!bridgeContext) {
    throw new Error("動画転送用の2D Canvasコンテキストを取得できませんでした");
  }
  const pipelines = pipelineBuilder(device, inputTexture);
  const outputTexture = pipelines.at(-1)?.getOutputTexture();
  if (!outputTexture) throw new Error("フィルター出力テクスチャを取得できませんでした");

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } }
    ]
  });
  const renderPipeline = device.createRenderPipeline({
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
  const displaySettingsBuffer = device.createBuffer({
    label: "YouTube Filter display settings",
    size: 4,
    usage: GPUBufferUsage.UNIFORM,
    mappedAtCreation: true
  });
  new Uint32Array(displaySettingsBuffer.getMappedRange())[0] = COLOR_RANGE_MODE_VALUES[colorRangeMode] ?? 0;
  displaySettingsBuffer.unmap();
  const bindGroup = device.createBindGroup({
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

  let stopped = false;
  let inputSampleReported = false;
  let gpuInputSampleReported = false;
  let gpuOutputSampleReported = false;
  let frameRequestId;
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
    if (!firstFrameSettled) {
      firstFrameSettled = true;
      clearTimeout(firstFrameTimeoutId);
      rejectFirstFrame(error);
    } else {
      onRuntimeError?.(error);
    }
  };

  const drawFrame = () => {
    if (stopped || !video.isConnected) return;

    try {
      // HTMLVideoElementからWebGPUへ直接コピーすると、Chrome/ANGLEの動画デコード
      // 経路によっては検証エラーなしで黒い画素が返る。2D Canvasを中継して
      // デコーダー固有の内部表現をRGBAへ確実に変換する。
      bridgeContext.drawImage(
        video,
        0,
        0,
        video.videoWidth,
        video.videoHeight
      );
      if (!inputSampleReported && onInputSample) {
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
      const frameBitmap = bridgeCanvas.transferToImageBitmap();
      device.queue.copyExternalImageToTexture(
        { source: frameBitmap },
        { texture: inputTexture, colorSpace: "srgb" },
        [video.videoWidth, video.videoHeight]
      );

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
      device.queue.submit([encoder.finish()]);
      // Dawnが外部画像コピーを遅延実行する可能性があるため、GPU完了まで
      // ImageBitmapを生存させる。
      device.queue.onSubmittedWorkDone().then(
        () => frameBitmap.close(),
        () => frameBitmap.close()
      );

      if (outputReadbackBuffer) {
        outputReadbackBuffer.mapAsync(GPUMapMode.READ).then(() => {
          const rgba = Array.from(new Uint8Array(outputReadbackBuffer.getMappedRange(), 0, 4));
          onGpuOutputSample(rgba);
          outputReadbackBuffer.unmap();
          outputReadbackBuffer.destroy();
        }, (error) => {
          outputReadbackBuffer.destroy();
          onRuntimeError?.(error);
        });
      }

      if (!gpuInputSampleReported && onGpuInputSample) {
        gpuInputSampleReported = true;
        const readbackBuffer = device.createBuffer({
          size: 256,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });
        const readbackEncoder = device.createCommandEncoder();
        readbackEncoder.copyTextureToBuffer(
          {
            texture: inputTexture,
            origin: {
              x: Math.floor(video.videoWidth / 2),
              y: Math.floor(video.videoHeight / 2)
            }
          },
          { buffer: readbackBuffer, bytesPerRow: 256 },
          { width: 1, height: 1 }
        );
        device.queue.submit([readbackEncoder.finish()]);
        readbackBuffer.mapAsync(GPUMapMode.READ).then(() => {
          const rgba = Array.from(new Uint8Array(readbackBuffer.getMappedRange(), 0, 4));
          onGpuInputSample(rgba);
          readbackBuffer.unmap();
          readbackBuffer.destroy();
        }, (error) => {
          readbackBuffer.destroy();
          onRuntimeError?.(error);
        });
      }

      if (!firstFrameSettled) {
        device.queue.onSubmittedWorkDone().then(() => {
          if (firstFrameSettled) return;
          firstFrameSettled = true;
          clearTimeout(firstFrameTimeoutId);
          resolveFirstFrame();
        }, fail);
      }
    } catch (error) {
      fail(error);
      return;
    }

    frameRequestId = video.requestVideoFrameCallback(drawFrame);
  };

  frameRequestId = video.requestVideoFrameCallback(drawFrame);
  await firstFrame;

  return {
    device,
    inputFormat: "rgba8unorm",
    inputTransfer: "2d-canvas-to-image-bitmap",
    stop() {
      stopped = true;
      if (frameRequestId !== undefined) video.cancelVideoFrameCallback(frameRequestId);
      inputTexture.destroy();
      displaySettingsBuffer.destroy();
    }
  };
}
