let cachedRecord;
let pendingRecord;
let deviceGeneration = 0;

async function createDeviceRecord() {
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("WebGPUアダプターを取得できませんでした");
  const device = await adapter.requestDevice();
  const record = { device, lossListeners: new Set() };
  device.lost.then((information) => {
    if (cachedRecord === record) cachedRecord = undefined;
    for (const listener of record.lossListeners) listener(information);
    record.lossListeners.clear();
  });
  return record;
}

export async function getWebGpuDevice() {
  if (cachedRecord) return cachedRecord.device;
  if (!pendingRecord) {
    const generation = deviceGeneration;
    let request;
    request = createDeviceRecord().then((record) => {
      if (generation !== deviceGeneration) {
        record.device.destroy();
        throw new Error("WebGPUデバイスの取得中にページが破棄されました");
      }
      cachedRecord = record;
      return record;
    }).finally(() => {
      if (pendingRecord === request) pendingRecord = undefined;
    });
    pendingRecord = request;
  }
  return (await pendingRecord).device;
}

export function subscribeWebGpuDeviceLoss(device, listener) {
  const record = cachedRecord;
  if (!record || record.device !== device) return () => {};
  record.lossListeners.add(listener);
  return () => record.lossListeners.delete(listener);
}

export function disposeWebGpuDevice() {
  deviceGeneration += 1;
  const record = cachedRecord;
  cachedRecord = undefined;
  pendingRecord = undefined;
  record?.lossListeners.clear();
  record?.device.destroy();
}
