import {
  CNNx2M,
  CNNSoftM,
  CNNVL,
  ClampHighlights,
  GANUUL,
  GANx4UUL,
  ModeA,
  ModeAA,
  ModeB,
  ModeBB,
  ModeC,
  Original
} from "anime4k-webgpu";
import { render } from "./renderer.js";
import { createPlayerSettingsUi } from "./player-settings.js";

const CANVAS_CLASS = "youtube-filter-canvas";
const VIDEO_CLASS = "youtube-filter-source";
let activeVideo = null;
let initializationInProgress = false;
let detailedLogging = false;
let cancelActiveProcessing = null;
let playerSettingsUi = null;
let currentSettings = {
  enabled: true,
  profile: "auto",
  colorRangeMode: "none",
  detailedLogging: false,
  diagnosticStage: "full"
};
const failedSources = new WeakMap();

const DIAGNOSTIC_STAGE_NAMES = {
  full: "D: 通常の全処理",
  source: "A: 入力映像のみ",
  clamp: "B: ClampHighlightsまで",
  restore: "C: Restore CNN VLまで"
};
const VALID_PROFILES = new Set([
  "auto",
  "mode-a",
  "mode-b",
  "mode-c",
  "mode-aa",
  "mode-bb",
  "mode-ac",
  "v4.1-low-resolution"
]);
const VALID_COLOR_RANGE_MODES = new Set(["none", "limited-to-full", "full-to-limited"]);
const COLOR_RANGE_NAMES = {
  none: "変換なし",
  "limited-to-full": "リミテッド → フル",
  "full-to-limited": "フル → リミテッド"
};
const PROFILE_NAMES = {
  auto: "Mode A（自動）",
  "mode-a": "Mode A",
  "mode-b": "Mode B",
  "mode-c": "Mode C",
  "mode-aa": "Mode A+A",
  "mode-bb": "Mode B+B",
  "mode-ac": "Mode A+C（カスタム）",
  "v4.1-low-resolution": "v4.1 Low resolution experiment"
};

function normalizeSettings(settings) {
  return {
    enabled: typeof settings.enabled === "boolean" ? settings.enabled : true,
    profile: VALID_PROFILES.has(settings.profile) ? settings.profile : "auto",
    colorRangeMode: VALID_COLOR_RANGE_MODES.has(settings.colorRangeMode)
      ? settings.colorRangeMode
      : "none",
    detailedLogging: settings.detailedLogging === true,
    diagnosticStage: Object.hasOwn(DIAGNOSTIC_STAGE_NAMES, settings.diagnosticStage)
      ? settings.diagnosticStage
      : "full"
  };
}

function report(message, error) {
  const method = error ? "error" : "info";
  console[method](`[YouTube Filter] ${message}`, error ?? "");
}

function diagnostic(message, details) {
  if (!detailedLogging) return;
  console.info(`[YouTube Filter][詳細] ${message}`, details ?? "");
}

function getSafeSourceDescription(video) {
  if (!video.currentSrc) return "未設定";
  try {
    const source = new URL(video.currentSrc);
    return `${source.protocol}//${source.host || "ローカル"}`;
  } catch {
    return "解析不能";
  }
}

function getVideoState(video) {
  const bounds = video.getBoundingClientRect();
  return {
    source: getSafeSourceDescription(video),
    crossOrigin: video.crossOrigin || "未設定",
    readyState: video.readyState,
    networkState: video.networkState,
    paused: video.paused,
    ended: video.ended,
    currentTime: Number(video.currentTime.toFixed(3)),
    intrinsicSize: `${video.videoWidth}x${video.videoHeight}`,
    displaySize: `${Math.round(bounds.width)}x${Math.round(bounds.height)}`,
    devicePixelRatio: window.devicePixelRatio
  };
}

function getDeviceDetails(device) {
  const limits = device.limits;
  return {
    architecture: device.adapterInfo?.architecture || "取得不可",
    device: device.adapterInfo?.device || "取得不可",
    description: device.adapterInfo?.description || "取得不可",
    maxTextureDimension2D: limits.maxTextureDimension2D,
    maxStorageTexturesPerShaderStage: limits.maxStorageTexturesPerShaderStage,
    maxComputeWorkgroupStorageSize: limits.maxComputeWorkgroupStorageSize
  };
}

function waitForNextVideoFrame(video, timeoutMilliseconds = 5000) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`${timeoutMilliseconds}ms以内に動画フレームを取得できませんでした`));
    }, timeoutMilliseconds);

    video.requestVideoFrameCallback((now, metadata) => {
      clearTimeout(timeoutId);
      resolve({
        callbackTime: Number(now.toFixed(2)),
        mediaTime: Number(metadata.mediaTime.toFixed(3)),
        presentedFrames: metadata.presentedFrames,
        presentationTime: Number(metadata.presentationTime.toFixed(2)),
        expectedDisplayTime: Number(metadata.expectedDisplayTime.toFixed(2)),
        width: metadata.width,
        height: metadata.height
      });
    });
  });
}

function waitForGpu(device, timeoutMilliseconds = 5000) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`${timeoutMilliseconds}ms以内にGPU処理が完了しませんでした`));
    }, timeoutMilliseconds);

    device.queue.onSubmittedWorkDone().then(
      () => {
        clearTimeout(timeoutId);
        resolve();
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}

function startFrameDiagnostics(video, canvas) {
  if (!detailedLogging) return;
  let observedFrames = 0;
  let startedAt = performance.now();

  const observe = (now, metadata) => {
    if (!video.isConnected || activeVideo !== video) return;
    observedFrames += 1;
    if (observedFrames % 120 === 0) {
      const elapsedSeconds = Math.max((now - startedAt) / 1000, 0.001);
      diagnostic("フレーム監視", {
        observedFrames,
        approximateFps: Number((120 / elapsedSeconds).toFixed(1)),
        presentedFrames: metadata.presentedFrames,
        mediaTime: Number(metadata.mediaTime.toFixed(3)),
        videoSize: `${metadata.width}x${metadata.height}`,
        canvasSize: `${canvas.width}x${canvas.height}`
      });
      startedAt = now;
    }
    video.requestVideoFrameCallback(observe);
  };

  video.requestVideoFrameCallback(observe);
}

function waitForVideoMetadata(video) {
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA && video.videoWidth > 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    video.addEventListener("loadedmetadata", resolve, { once: true });
  });
}

function setCanvasSize(canvas, video) {
  const bounds = video.getBoundingClientRect();
  const maximumDimension = 4096;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const requestedWidth = Math.max(1, Math.round(bounds.width * pixelRatio));
  const requestedHeight = Math.max(1, Math.round(bounds.height * pixelRatio));
  const scale = Math.min(1, maximumDimension / Math.max(requestedWidth, requestedHeight));

  const width = Math.max(1, Math.round(requestedWidth * scale));
  const height = Math.max(1, Math.round(requestedHeight * scale));
  // 同じ値の再代入でもCanvasの描画バッファが初期化されるため、実寸変更時だけ更新する。
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
}

function createCanvas(video) {
  const canvas = document.createElement("canvas");
  canvas.className = CANVAS_CLASS;
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "absolute",
    inset: "auto",
    objectFit: "contain",
    pointerEvents: "none",
    zIndex: "1"
  });

  const container = video.parentElement;
  if (!container) {
    throw new Error("動画コンテナが見つかりません");
  }
  if (getComputedStyle(container).position === "static") {
    container.style.position = "relative";
  }

  const syncCanvasLayout = () => {
    if (!video.isConnected || !canvas.isConnected) return;
    const videoBounds = video.getBoundingClientRect();
    const containerBounds = container.getBoundingClientRect();
    Object.assign(canvas.style, {
      left: `${videoBounds.left - containerBounds.left}px`,
      top: `${videoBounds.top - containerBounds.top}px`,
      width: `${videoBounds.width}px`,
      height: `${videoBounds.height}px`
    });
    setCanvasSize(canvas, video);
  };

  container.append(canvas);
  syncCanvasLayout();
  const resizeObserver = new ResizeObserver(syncCanvasLayout);
  resizeObserver.observe(video);
  resizeObserver.observe(container);
  window.addEventListener("resize", syncCanvasLayout);
  document.addEventListener("fullscreenchange", syncCanvasLayout);

  diagnostic("Canvasを作成", {
    backingSize: `${canvas.width}x${canvas.height}`,
    cssSize: `${Math.round(video.getBoundingClientRect().width)}x${Math.round(video.getBoundingClientRect().height)}`
  });
  return {
    canvas,
    stopLayoutSync() {
      resizeObserver.disconnect();
      window.removeEventListener("resize", syncCanvasLayout);
      document.removeEventListener("fullscreenchange", syncCanvasLayout);
    }
  };
}

function buildModeA(device, inputTexture, video, canvas) {
  return [
    new ModeA({
      device,
      inputTexture,
      nativeDimensions: {
        width: video.videoWidth,
        height: video.videoHeight
      },
      targetDimensions: {
        width: canvas.width,
        height: canvas.height
      }
    })
  ];
}

function getPresetDescriptor(device, inputTexture, video, canvas) {
  return {
    device,
    inputTexture,
    nativeDimensions: {
      width: video.videoWidth,
      height: video.videoHeight
    },
    targetDimensions: {
      width: canvas.width,
      height: canvas.height
    }
  };
}

function buildPreset(profile, device, inputTexture, video, canvas) {
  const descriptor = getPresetDescriptor(device, inputTexture, video, canvas);
  switch (profile) {
    case "mode-b":
      return [new ModeB(descriptor)];
    case "mode-c":
      return [new ModeC(descriptor)];
    case "mode-aa":
      return [new ModeAA(descriptor)];
    case "mode-bb":
      return [new ModeBB(descriptor)];
    case "mode-ac": {
      const modeA = new ModeA(descriptor);
      const modeAOutput = modeA.getOutputTexture();
      const modeC = new ModeC({
        device,
        inputTexture: modeAOutput,
        nativeDimensions: {
          width: modeAOutput.width,
          height: modeAOutput.height
        },
        targetDimensions: descriptor.targetDimensions
      });
      return [modeA, modeC];
    }
    default:
      return buildModeA(device, inputTexture, video, canvas);
  }
}

function buildLowResolutionExperiment(device, inputTexture) {
  const restoreGan = new GANUUL({ device, inputTexture });
  const upscaleGan = new GANx4UUL({
    device,
    inputTexture: restoreGan.getOutputTexture()
  });
  const restoreSoft = new CNNSoftM({
    device,
    inputTexture: upscaleGan.getOutputTexture()
  });
  const upscaleCnn = new CNNx2M({
    device,
    inputTexture: restoreSoft.getOutputTexture()
  });

  return [restoreGan, upscaleGan, restoreSoft, upscaleCnn];
}

function buildDiagnosticPipeline(stage, device, inputTexture) {
  if (stage === "source") {
    return [new Original({ inputTexture })];
  }

  const clampHighlights = new ClampHighlights({ device, inputTexture });
  if (stage === "clamp") {
    return [clampHighlights];
  }

  const restore = new CNNVL({
    device,
    inputTexture: clampHighlights.getOutputTexture()
  });
  return [clampHighlights, restore];
}

async function applyFilters(video, { enabled, profile, colorRangeMode, diagnosticStage }) {
  if (initializationInProgress || activeVideo === video || !navigator.gpu) {
    if (!navigator.gpu) report("WebGPUが利用できないため、元の映像を表示します");
    return;
  }

  initializationInProgress = true;
  let canvas;
  let stopCanvasLayoutSync;
  let renderingDevice;
  let rendererController;
  let validationScopeActive = false;
  let failed = false;
  let cancelled = false;
  const originalVisibility = video.style.visibility;

  const cancelProcessing = () => {
    if (cancelled) return;
    cancelled = true;
    rendererController?.stop();
    stopCanvasLayoutSync?.();
    canvas?.remove();
    video.style.visibility = originalVisibility;
    video.classList.remove(VIDEO_CLASS);
    if (activeVideo === video) activeVideo = null;
    diagnostic("現在のフィルター処理を停止");
  };
  cancelActiveProcessing = cancelProcessing;

  const restoreOriginalVideo = (reason, error) => {
    if (failed) return;
    failed = true;
    failedSources.set(video, video.currentSrc);
    rendererController?.stop();
    stopCanvasLayoutSync?.();
    canvas?.remove();
    video.style.visibility = originalVisibility;
    video.classList.remove(VIDEO_CLASS);
    if (activeVideo === video) activeVideo = null;
    report(`${reason}。元の映像へ戻しました`, error);
  };

  try {
    diagnostic("初期化を開始", {
      anime4kEnabled: enabled,
      profile,
      colorRangeMode,
      diagnosticStage: DIAGNOSTIC_STAGE_NAMES[diagnosticStage],
      video: getVideoState(video)
    });
    video.crossOrigin = "anonymous";
    await waitForVideoMetadata(video);
    if (cancelled) return;
    diagnostic("動画メタデータを取得", getVideoState(video));

    if (enabled && diagnosticStage === "full" && profile === "v4.1-low-resolution" && video.videoHeight > 360) {
      report(`v4.1低解像度モードは360p以下専用です（現在: ${video.videoHeight}p）。元の映像を表示します`);
      return;
    }

    ({ canvas, stopLayoutSync: stopCanvasLayoutSync } = createCanvas(video));

    rendererController = await render({
      video,
      canvas,
      colorRangeMode,
      onInputSample: detailedLogging
        ? (samples) => diagnostic("2D Canvas中継後の入力画素", JSON.stringify(samples))
        : undefined,
      onGpuInputSample: detailedLogging
        ? (rgba) => diagnostic("WebGPU入力テクスチャ中央の画素", JSON.stringify(rgba))
        : undefined,
      onGpuOutputSample: detailedLogging
        ? (rgba) => diagnostic("WebGPU表示直前の中央画素", JSON.stringify(rgba))
        : undefined,
      onRuntimeError: (error) => {
        diagnostic("レンダリングループの実行時エラー", {
          name: error?.constructor?.name,
          message: error?.message
        });
        restoreOriginalVideo("動画フレームのWebGPU処理に失敗しました", error);
      },
      pipelineBuilder: (device, inputTexture) => {
        renderingDevice = device;
        diagnostic("WebGPUデバイスを取得", getDeviceDetails(device));

        device.addEventListener("uncapturederror", (event) => {
          diagnostic("WebGPU未捕捉エラーの詳細", {
            name: event.error?.constructor?.name,
            message: event.error?.message
          });
          restoreOriginalVideo("WebGPUで未捕捉エラーが発生しました", event.error);
        });
        device.lost.then((information) => {
          diagnostic("WebGPUデバイスロストの詳細", information);
          restoreOriginalVideo(`WebGPUデバイスが失われました (${information.reason})`, new Error(information.message));
        });

        device.pushErrorScope("validation");
        validationScopeActive = true;
        const pipelines = !enabled
          ? [new Original({ inputTexture })]
          : diagnosticStage !== "full"
            ? buildDiagnosticPipeline(diagnosticStage, device, inputTexture)
            : profile === "v4.1-low-resolution"
              ? buildLowResolutionExperiment(device, inputTexture)
              : buildPreset(profile, device, inputTexture, video, canvas);
        diagnostic("パイプラインを構築", {
          anime4kEnabled: enabled,
          profile,
          colorRangeMode,
          diagnosticStage: DIAGNOSTIC_STAGE_NAMES[diagnosticStage],
          pipelineCount: pipelines.length,
          inputTextureFormat: "rgba8unorm",
          inputSize: `${video.videoWidth}x${video.videoHeight}`,
          outputSize: `${canvas.width}x${canvas.height}`
        });
        return pipelines;
      }
    });

    if (cancelled) {
      rendererController.stop();
      return;
    }
    if (failed) {
      rendererController.stop();
      return;
    }
    diagnostic("レンダリングループを登録", {
      inputFormat: rendererController.inputFormat,
      inputTransfer: rendererController.inputTransfer
    });
    if (!renderingDevice) throw new Error("WebGPUデバイスを取得できませんでした");

    if (validationScopeActive) {
      const validationError = await renderingDevice.popErrorScope();
      validationScopeActive = false;
      if (validationError) throw validationError;
      diagnostic("初期化時のWebGPU検証エラーなし");
    }

    const firstFrame = await waitForNextVideoFrame(video);
    if (failed || cancelled) return;
    diagnostic("最初の動画フレームを確認", firstFrame);
    await waitForGpu(renderingDevice);
    if (failed || cancelled) return;
    diagnostic("最初のGPU処理完了を確認");

    activeVideo = video;
    video.classList.add(VIDEO_CLASS);
    // opacity: 0ではChrome/ANGLEの動画オーバーレイ面が残り、正常に描画された
    // WebGPU Canvasを黒く覆う場合がある。visibilityはレイアウトと動画デコードを
    // 維持しつつ、動画要素を合成対象から外す。
    video.style.visibility = "hidden";
    if (detailedLogging) {
      const canvasStyle = getComputedStyle(canvas);
      const containerStyle = getComputedStyle(canvas.parentElement);
      const bounds = canvas.getBoundingClientRect();
      const centerX = bounds.left + bounds.width / 2;
      const centerY = bounds.top + bounds.height / 2;
      diagnostic("CanvasのDOM合成状態", {
        canvas: {
          display: canvasStyle.display,
          visibility: canvasStyle.visibility,
          opacity: canvasStyle.opacity,
          zIndex: canvasStyle.zIndex,
          bounds: `${Math.round(bounds.width)}x${Math.round(bounds.height)}`
        },
        container: {
          display: containerStyle.display,
          visibility: containerStyle.visibility,
          opacity: containerStyle.opacity,
          zIndex: containerStyle.zIndex
        },
        stackingOrderAtCenter: document.elementsFromPoint(centerX, centerY)
          .slice(0, 8)
          .map((element) => ({
            tag: element.tagName,
            id: element.id,
            className: typeof element.className === "string"
              ? element.className.slice(0, 160)
              : ""
          }))
      });
    }
    startFrameDiagnostics(video, canvas);
    const appliedFilters = [];
    if (enabled) {
      const appliedMode = diagnosticStage !== "full"
        ? `診断パス ${DIAGNOSTIC_STAGE_NAMES[diagnosticStage]}`
        : PROFILE_NAMES[profile];
      appliedFilters.push(`Anime4K ${appliedMode}`);
    }
    if (colorRangeMode !== "none") appliedFilters.push(`色レンジ ${COLOR_RANGE_NAMES[colorRangeMode]}`);
    report(`${appliedFilters.join(" / ")}の最初のGPU処理が完了しました (${video.videoWidth}x${video.videoHeight} → ${canvas.width}x${canvas.height})`);
  } catch (error) {
    if (validationScopeActive && renderingDevice) {
      renderingDevice.popErrorScope().catch(() => {});
    }
    restoreOriginalVideo("フィルターの初期化または最初のフレーム処理に失敗しました", error);
  } finally {
    initializationInProgress = false;
    if (cancelled && cancelActiveProcessing === cancelProcessing) {
      cancelActiveProcessing = null;
    }
    if ((currentSettings.enabled || currentSettings.colorRangeMode !== "none") && !activeVideo) {
      queueMicrotask(findYouTubeVideo);
    }
  }
}

function findYouTubeVideo() {
  if (!currentSettings.enabled && currentSettings.colorRangeMode === "none") return;
  const video = document.querySelector("#movie_player video.html5-main-video");
  const sourcePreviouslyFailed = video && failedSources.get(video) === video.currentSrc;
  if (video && video !== activeVideo && !sourcePreviouslyFailed) {
    applyFilters(video, currentSettings);
  }
}

function applySettings(changes) {
  const previousSettings = currentSettings;
  currentSettings = normalizeSettings({ ...currentSettings, ...changes });
  detailedLogging = currentSettings.detailedLogging;
  playerSettingsUi?.sync();

  diagnostic("設定変更を検出", {
    previous: previousSettings,
    current: currentSettings
  });

  const video = document.querySelector("#movie_player video.html5-main-video");
  cancelActiveProcessing?.();
  cancelActiveProcessing = null;
  activeVideo = null;
  if (video) failedSources.delete(video);
  findYouTubeVideo();
}

async function start() {
  const settings = await chrome.storage.local.get({
    enabled: true,
    profile: "auto",
    colorRangeMode: "none",
    detailedLogging: false,
    diagnosticStage: "full"
  });
  currentSettings = normalizeSettings(settings);
  detailedLogging = currentSettings.detailedLogging;
  playerSettingsUi = createPlayerSettingsUi({
    getSettings: () => currentSettings,
    onChange: (changes) => chrome.storage.local.set(changes)
  });

  diagnostic("詳細ログモードで開始", {
    profile: currentSettings.profile,
    colorRangeMode: currentSettings.colorRangeMode,
    diagnosticStage: DIAGNOSTIC_STAGE_NAMES[currentSettings.diagnosticStage],
    page: `${location.origin}${location.pathname}`,
    webGpuAvailable: Boolean(navigator.gpu)
  });

  const refreshPlayer = () => {
    findYouTubeVideo();
    playerSettingsUi.ensure();
  };
  new MutationObserver(refreshPlayer).observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  window.addEventListener("yt-navigate-finish", refreshPlayer);
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    const relevantChanges = {};
    for (const key of ["enabled", "profile", "colorRangeMode", "detailedLogging", "diagnosticStage"]) {
      if (changes[key]) relevantChanges[key] = changes[key].newValue;
    }
    if (Object.keys(relevantChanges).length > 0) applySettings(relevantChanges);
  });
  refreshPlayer();
}

start().catch((error) => report("拡張機能を開始できませんでした", error));
