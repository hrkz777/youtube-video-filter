import assert from "node:assert/strict";
import {
  disposeWebGpuDevice,
  getWebGpuDevice,
  subscribeWebGpuDeviceLoss
} from "../src/webgpu-device.js";

function createDeferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

let adapterRequests = 0;
let deviceRequests = 0;
const devices = [];
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: {
    gpu: {
      async requestAdapter() {
        adapterRequests += 1;
        return {
          async requestDevice() {
            deviceRequests += 1;
            const lost = createDeferred();
            const device = {
              lost: lost.promise,
              lostDeferred: lost,
              destroyed: false,
              destroy() { this.destroyed = true; }
            };
            devices.push(device);
            return device;
          }
        };
      }
    }
  }
});

const firstDevice = await getWebGpuDevice();
assert.equal(await getWebGpuDevice(), firstDevice);
assert.equal(adapterRequests, 1);
assert.equal(deviceRequests, 1);

let lossInformation;
const unsubscribe = subscribeWebGpuDeviceLoss(firstDevice, (information) => {
  lossInformation = information;
});
firstDevice.lostDeferred.resolve({ reason: "unknown", message: "lost" });
await new Promise((resolve) => setImmediate(resolve));
assert.deepEqual(lossInformation, { reason: "unknown", message: "lost" });
unsubscribe();

const secondDevice = await getWebGpuDevice();
assert.notEqual(secondDevice, firstDevice);
assert.equal(adapterRequests, 2);
assert.equal(deviceRequests, 2);
disposeWebGpuDevice();
assert.equal(secondDevice.destroyed, true);

console.log("WebGPU Deviceの再利用と再取得を検証しました。");
