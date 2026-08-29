import assert from "node:assert/strict";
import { createDisplaySettingsData, render } from "../src/renderer.js";
import { disposeWebGpuDevice } from "../src/webgpu-device.js";

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

{
  const neutralData = createDisplaySettingsData("none");
  assert.equal(neutralData.byteLength, 16);
  assert.equal(new Uint32Array(neutralData)[0], 0);
  assert.deepEqual(Array.from(new Float32Array(neutralData).slice(1, 3)), [0, 1]);

  const adjustedData = createDisplaySettingsData("limited-to-full", 25, -40);
  assert.equal(new Uint32Array(adjustedData)[0], 1);
  const adjustedValues = new Float32Array(adjustedData);
  assert.ok(Math.abs(adjustedValues[1] - 0.25) < 1e-6);
  assert.ok(Math.abs(adjustedValues[2] - 0.6) < 1e-6);
}

function installWebGpuMocks() {
  const submittedWork = [];
  const mappedBuffers = [];
  const bufferWrites = [];

  class FakeBuffer {
    constructor(options) {
      this.data = new ArrayBuffer(options.size);
      this.destroyed = false;
      this.mapDeferred = options.usage & GPUBufferUsage.MAP_READ
        ? createDeferred()
        : null;
      if (this.mapDeferred) mappedBuffers.push(this);
    }

    getMappedRange() {
      return this.data;
    }

    mapAsync() {
      return this.mapDeferred.promise;
    }

    unmap() {}

    destroy() {
      this.destroyed = true;
    }
  }

  const createTexture = () => ({
    createView() {
      return {};
    },
    destroy() {}
  });
  const device = {
    destroyed: false,
    lost: new Promise(() => {}),
    queue: {
      copyExternalImageToTexture() {},
      submit() {},
      writeBuffer(buffer, offset, data) {
        bufferWrites.push({ buffer, offset, data: data.slice(0) });
      },
      onSubmittedWorkDone() {
        const deferred = createDeferred();
        submittedWork.push(deferred);
        return deferred.promise;
      }
    },
    createTexture,
    createBuffer(options) {
      return new FakeBuffer(options);
    },
    createBindGroupLayout() {
      return {};
    },
    createPipelineLayout() {
      return {};
    },
    createShaderModule() {
      return {};
    },
    createRenderPipeline() {
      return {};
    },
    createSampler() {
      return {};
    },
    createBindGroup() {
      return {};
    },
    createCommandEncoder() {
      return {
        beginRenderPass() {
          return {
            setPipeline() {},
            setBindGroup() {},
            draw() {},
            end() {}
          };
        },
        copyTextureToBuffer() {},
        finish() {
          return {};
        }
      };
    },
    destroy() {
      this.destroyed = true;
    }
  };

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      gpu: {
        async requestAdapter() {
          return {
            async requestDevice() {
              return device;
            }
          };
        },
        getPreferredCanvasFormat() {
          return "rgba8unorm";
        }
      }
    }
  });
  globalThis.HTMLMediaElement = { HAVE_CURRENT_DATA: 2 };
  globalThis.GPUTextureUsage = {
    COPY_SRC: 1,
    COPY_DST: 2,
    TEXTURE_BINDING: 4,
    RENDER_ATTACHMENT: 8
  };
  globalThis.GPUBufferUsage = { COPY_DST: 1, MAP_READ: 2, UNIFORM: 4 };
  globalThis.GPUShaderStage = { FRAGMENT: 1 };
  globalThis.GPUMapMode = { READ: 1 };
  globalThis.OffscreenCanvas = class {
    constructor(width, height) {
      this.width = width;
      this.height = height;
    }

    getContext() {
      return { drawImage() {} };
    }

    transferToImageBitmap() {
      return { close() {} };
    }
  };

  return { device, mappedBuffers, submittedWork, bufferWrites };
}

function createVideo() {
  let nextFrameId = 0;
  const callbacks = new Map();
  return {
    readyState: 2,
    videoWidth: 1920,
    videoHeight: 1080,
    currentTime: 1,
    isConnected: true,
    addEventListener() {},
    removeEventListener() {},
    requestVideoFrameCallback(callback) {
      const id = ++nextFrameId;
      callbacks.set(id, callback);
      return id;
    },
    cancelVideoFrameCallback(id) {
      callbacks.delete(id);
    },
    fireFrame() {
      const [id, callback] = callbacks.entries().next().value;
      callbacks.delete(id);
      callback(performance.now(), { mediaTime: this.currentTime });
    }
  };
}

function createCanvas() {
  const presentationTexture = {
    createView() {
      return {};
    }
  };
  const context = {
    configure() {},
    unconfigure() {},
    getCurrentTexture() {
      return presentationTexture;
    }
  };
  return {
    width: 1280,
    height: 720,
    getContext() {
      return context;
    }
  };
}

function buildPipeline(device) {
  const outputTexture = device.createTexture({});
  return [{
    outputTexture,
    getOutputTexture() {
      return outputTexture;
    },
    pass() {}
  }];
}

async function flushPromises() {
  await new Promise((resolve) => setImmediate(resolve));
}

{
  const { device, mappedBuffers, submittedWork, bufferWrites } = installWebGpuMocks();
  const video = createVideo();
  const runtimeErrors = [];
  const rendererPromise = render({
    video,
    canvas: createCanvas(),
    colorRangeMode: "none",
    pipelineBuilder: buildPipeline,
    onRuntimeError: (error) => runtimeErrors.push(error),
    onGpuInputSample() {},
    onGpuOutputSample() {}
  });
  await flushPromises();
  video.fireFrame();
  submittedWork[0].resolve();
  const renderer = await rendererPromise;

  assert.equal(renderer.updateDisplaySettings({
    colorRangeMode: "full-to-limited",
    brightness: -25,
    contrast: 50
  }), true);
  assert.equal(bufferWrites.length, 1);
  assert.equal(new Uint32Array(bufferWrites[0].data)[0], 2);
  const updatedValues = new Float32Array(bufferWrites[0].data);
  assert.ok(Math.abs(updatedValues[1] + 0.25) < 1e-6);
  assert.ok(Math.abs(updatedValues[2] - 1.5) < 1e-6);

  video.fireFrame();
  renderer.stop();
  assert.equal(renderer.updateDisplaySettings({
    colorRangeMode: "none",
    brightness: 0,
    contrast: 0
  }), false);
  submittedWork[1].reject(new Error("停止後のGPU完了待ちエラー"));
  for (const buffer of mappedBuffers) {
    buffer.mapDeferred.reject(new Error("停止後の診断読み取りエラー"));
  }
  await flushPromises();

  assert.equal(device.destroyed, false);
  assert.equal(runtimeErrors.length, 0);
  assert.equal(mappedBuffers.every((buffer) => buffer.destroyed), true);
  disposeWebGpuDevice();
  assert.equal(device.destroyed, true);
}

{
  const { submittedWork } = installWebGpuMocks();
  const video = createVideo();
  const runtimeErrors = [];
  const rendererPromise = render({
    video,
    canvas: createCanvas(),
    colorRangeMode: "none",
    pipelineBuilder: buildPipeline,
    onRuntimeError: (error) => runtimeErrors.push(error)
  });
  await flushPromises();
  video.fireFrame();
  submittedWork[0].resolve();
  const renderer = await rendererPromise;

  video.fireFrame();
  submittedWork[1].reject(new Error("実行中のGPUエラー"));
  await flushPromises();

  assert.equal(runtimeErrors.length, 1);
  assert.equal(runtimeErrors[0].message, "実行中のGPUエラー");
  renderer.stop();
  disposeWebGpuDevice();
}

console.log("停止済みRendererの非同期GPUエラー遮断を検証しました。");
