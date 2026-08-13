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
const FILTER_RESIZE_DEBOUNCE_MILLISECONDS = 300;
let activeVideo = null;
let activeVideoSource = "";
let initializationInProgress = false;
let detailedLogging = false;
let cancelActiveProcessing = null;
let playerSettingsUi = null;
const DEFAULT_SETTINGS = {
  enabled: true,
  profile: "auto",
  colorRangeMode: "none",
  detailedLogging: false,
  diagnosticStage: "full"
};
const SETTINGS_KEYS = Object.keys(DEFAULT_SETTINGS);
let defaultSettings = { ...DEFAULT_SETTINGS };
let tabSettings = {};
let currentSettings = { ...DEFAULT_SETTINGS };
let currentStatistics = {
  status: "初期化中",
  inputWidth: null,
  inputHeight: null,
  outputWidth: null,
  outputHeight: null,
  inputFps: null,
  outputFps: null,
  dropRate: null
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
  console[method](`[YouTube Video Filter] ${message}`, error ?? "");
}

function diagnostic(message, details) {
  if (!detailedLogging) return;
  console.info(`[YouTube Video Filter][詳細] ${message}`, details ?? "");
}

function updateStatistics(changes) {
  currentStatistics = { ...currentStatistics, ...changes };
  playerSettingsUi?.syncStatistics();
}

function resetStatistics(status) {
  currentStatistics = {
    status,
    inputWidth: null,
    inputHeight: null,
    outputWidth: null,
    outputHeight: null,
    inputFps: null,
    outputFps: null,
    dropRate: null
  };
  playerSettingsUi?.syncStatistics();
}

function getInactiveStatisticsStatus() {
  return currentSettings.enabled || currentSettings.colorRangeMode !== "none"
    ? "初期化中"
    : "無効";
}

function getSafeSourceUrl(sourceUrl) {
  if (!sourceUrl) return "未設定";
  try {
    const source = new URL(sourceUrl);
    return `${source.protocol}//${source.host || "ローカル"}`;
  } catch {
    return "解析不能";
  }
}

function getSafeSourceDescription(video) {
  return getSafeSourceUrl(video.currentSrc);
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

function getCanvasSize(video) {
  const bounds = video.getBoundingClientRect();
  const maximumDimension = 4096;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const requestedWidth = Math.max(1, Math.round(bounds.width * pixelRatio));
  const requestedHeight = Math.max(1, Math.round(bounds.height * pixelRatio));
  const scale = Math.min(1, maximumDimension / Math.max(requestedWidth, requestedHeight));

  const width = Math.max(1, Math.round(requestedWidth * scale));
  const height = Math.max(1, Math.round(requestedHeight * scale));
  return { width, height };
}

function setCanvasSize(canvas, size) {
  // 同じ値の再代入でもCanvasの描画バッファが初期化されるため、実寸変更時だけ更新する。
  if (canvas.width !== size.width) canvas.width = size.width;
  if (canvas.height !== size.height) canvas.height = size.height;
}

function createCanvas(video, onTargetSizeChange) {
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

  let targetSize;
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
    const nextTargetSize = getCanvasSize(video);
    if (!targetSize) {
      targetSize = nextTargetSize;
      setCanvasSize(canvas, targetSize);
      return;
    }
    if (nextTargetSize.width === targetSize.width && nextTargetSize.height === targetSize.height) return;
    targetSize = nextTargetSize;
    // 稼働中のWebGPU Canvasをリサイズすると取得済みのpresentation textureが
    // 無効になり得るため、CSSだけ追従させ、描画バッファは再初期化時に更新する。
    onTargetSizeChange?.(targetSize);
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
  if (document.visibilityState !== "visible"
    || initializationInProgress
    || activeVideo === video
    || !navigator.gpu) {
    if (!navigator.gpu) {
      updateStatistics({ status: "エラー" });
      report("WebGPUが利用できないため、元の映像を表示します");
    }
    return;
  }

  initializationInProgress = true;
  updateStatistics({ status: "初期化中" });
  let canvas;
  let stopCanvasLayoutSync;
  let renderingDevice;
  let rendererController;
  let validationScopeActive = false;
  let failed = false;
  let cancelled = false;
  let sourceAtInitialization = "";
  let lastDetailedStatisticsFrame = 0;
  let resizeRestartTimeoutId;
  let renderTargetSize;
  let latestTargetSize;
  const originalVisibility = video.style.visibility;
  const clearScheduledResizeRestart = () => {
    if (resizeRestartTimeoutId === undefined) return;
    clearTimeout(resizeRestartTimeoutId);
    resizeRestartTimeoutId = undefined;
  };
  const scheduleResizeRestart = (targetSize) => {
    latestTargetSize = targetSize;
    clearScheduledResizeRestart();
    if (targetSize.width <= 1 || targetSize.height <= 1
      || cancelled || failed || activeVideo !== video || !renderTargetSize
      || (targetSize.width === renderTargetSize.width && targetSize.height === renderTargetSize.height)) {
      return;
    }
    resizeRestartTimeoutId = setTimeout(() => {
      resizeRestartTimeoutId = undefined;
      if (cancelled || failed || activeVideo !== video) return;
      const currentTargetSize = getCanvasSize(video);
      if (currentTargetSize.width <= 1 || currentTargetSize.height <= 1
        || (currentTargetSize.width === renderTargetSize.width
        && currentTargetSize.height === renderTargetSize.height)) {
        return;
      }
      diagnostic("表示サイズの変更に合わせてフィルターを再初期化", {
        previousOutputSize: `${renderTargetSize.width}x${renderTargetSize.height}`,
        nextOutputSize: `${currentTargetSize.width}x${currentTargetSize.height}`
      });
      updateStatistics({ status: "初期化中" });
      cancelProcessing();
      queueMicrotask(findYouTubeVideo);
    }, FILTER_RESIZE_DEBOUNCE_MILLISECONDS);
  };
  const handlePlaybackStateChange = () => {
    if (cancelled || failed) return;
    updateStatistics({
      status: video.paused
        ? "一時停止中"
        : activeVideo === video
          ? "適用中"
          : "初期化中"
    });
  };

  const stopWatchingSource = () => {
    video.removeEventListener("loadstart", handleVideoSourceChange);
    video.removeEventListener("emptied", handleVideoSourceChange);
    video.removeEventListener("pause", handlePlaybackStateChange);
    video.removeEventListener("playing", handlePlaybackStateChange);
  };

  const cancelProcessing = () => {
    if (cancelled) return;
    cancelled = true;
    clearScheduledResizeRestart();
    stopWatchingSource();
    rendererController?.stop();
    stopCanvasLayoutSync?.();
    canvas?.remove();
    video.style.visibility = originalVisibility;
    video.classList.remove(VIDEO_CLASS);
    if (activeVideo === video) {
      activeVideo = null;
      activeVideoSource = "";
    }
    if (cancelActiveProcessing === cancelProcessing) cancelActiveProcessing = null;
    diagnostic("現在のフィルター処理を停止");
  };

  const handleVideoSourceChange = () => {
    if (cancelled || failed) return;
    diagnostic("動画ソースの変更を検出", {
      previousSource: sourceAtInitialization ? getSafeSourceUrl(sourceAtInitialization) : "未設定",
      currentSource: getSafeSourceDescription(video)
    });
    failedSources.delete(video);
    resetStatistics("初期化中");
    cancelProcessing();
    queueMicrotask(findYouTubeVideo);
  };
  cancelActiveProcessing = cancelProcessing;

  const restoreOriginalVideo = (reason, error) => {
    if (failed) return;
    failed = true;
    clearScheduledResizeRestart();
    stopWatchingSource();
    failedSources.set(video, video.currentSrc);
    rendererController?.stop();
    stopCanvasLayoutSync?.();
    canvas?.remove();
    video.style.visibility = originalVisibility;
    video.classList.remove(VIDEO_CLASS);
    if (activeVideo === video) {
      activeVideo = null;
      activeVideoSource = "";
    }
    if (cancelActiveProcessing === cancelProcessing) cancelActiveProcessing = null;
    updateStatistics({ status: "エラー" });
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
    sourceAtInitialization = video.currentSrc;
    diagnostic("動画メタデータを取得", getVideoState(video));

    if (enabled && diagnosticStage === "full" && profile === "v4.1-low-resolution" && video.videoHeight > 360) {
      updateStatistics({ status: "エラー" });
      report(`v4.1低解像度モードは360p以下専用です（現在: ${video.videoHeight}p）。元の映像を表示します`);
      return;
    }

    video.addEventListener("loadstart", handleVideoSourceChange);
    video.addEventListener("emptied", handleVideoSourceChange);
    video.addEventListener("pause", handlePlaybackStateChange);
    video.addEventListener("playing", handlePlaybackStateChange);

    ({ canvas, stopLayoutSync: stopCanvasLayoutSync } = createCanvas(video, scheduleResizeRestart));
    updateStatistics({
      inputWidth: video.videoWidth,
      inputHeight: video.videoHeight,
      outputWidth: canvas.width,
      outputHeight: canvas.height
    });

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
      onFrameStats: (stats) => {
        updateStatistics({
          status: video.paused ? "一時停止中" : "適用中",
          inputFps: stats.approximateInputFps,
          outputFps: stats.approximateOutputFps,
          dropRate: stats.intervalDropRate
        });
        if (detailedLogging && stats.receivedFrames - lastDetailedStatisticsFrame >= 120) {
          lastDetailedStatisticsFrame = stats.receivedFrames;
          diagnostic("Anime4Kフレーム同期", stats);
        }
      },
      onRuntimeError: (error) => {
        diagnostic("レンダリングループの実行時エラー", {
          name: error?.constructor?.name,
          message: error?.message
        });
        restoreOriginalVideo("動画フレームのWebGPU処理に失敗しました", error);
      },
      pipelineBuilder: (device, inputTexture) => {
        renderingDevice = device;
        renderTargetSize = { width: canvas.width, height: canvas.height };
        updateStatistics({
          outputWidth: renderTargetSize.width,
          outputHeight: renderTargetSize.height
        });
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
    activeVideoSource = sourceAtInitialization;
    updateStatistics({ status: video.paused ? "一時停止中" : "適用中" });
    scheduleResizeRestart(latestTargetSize ?? getCanvasSize(video));
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
  if (document.visibilityState !== "visible") return;
  if (!currentSettings.enabled && currentSettings.colorRangeMode === "none") return;
  const video = document.querySelector("#movie_player video.html5-main-video");
  if (video && video === activeVideo && video.currentSrc !== activeVideoSource) {
    diagnostic("処理中の動画ソース差し替えを検出", {
      previousSource: activeVideoSource ? getSafeSourceUrl(activeVideoSource) : "未設定",
      currentSource: getSafeSourceDescription(video)
    });
    failedSources.delete(video);
    resetStatistics("初期化中");
    cancelActiveProcessing?.();
  }
  const sourcePreviouslyFailed = video && failedSources.get(video) === video.currentSrc;
  if (video && video !== activeVideo && !sourcePreviouslyFailed) {
    applyFilters(video, currentSettings);
  }
}

function applySettings(changes, scope = "tab") {
  const previousSettings = currentSettings;
  if (scope === "defaults") {
    defaultSettings = normalizeSettings({ ...defaultSettings, ...changes });
  } else {
    tabSettings = { ...tabSettings, ...changes };
  }
  currentSettings = normalizeSettings({ ...defaultSettings, ...tabSettings });
  detailedLogging = currentSettings.detailedLogging;
  updateStatistics({ status: getInactiveStatisticsStatus() });
  playerSettingsUi?.sync();

  diagnostic("設定変更を検出", {
    previous: previousSettings,
    current: currentSettings
  });

  const video = document.querySelector("#movie_player video.html5-main-video");
  cancelActiveProcessing?.();
  cancelActiveProcessing = null;
  activeVideo = null;
  activeVideoSource = "";
  if (video) failedSources.delete(video);
  findYouTubeVideo();
}

function handleExtensionMessage(message, sender, sendResponse) {
  if (sender.id !== chrome.runtime.id || !message?.type?.startsWith("youtube-video-filter:")) return;
  if (message.type === "youtube-video-filter:apply-tab-settings") {
    tabSettings = Object.fromEntries(
      SETTINGS_KEYS.filter((key) => Object.hasOwn(message.settings ?? {}, key))
        .map((key) => [key, message.settings[key]])
    );
    applySettings({}, "tab");
    sendResponse({ settings: currentSettings });
  }
}

async function start() {
  const [settings, tabResponse] = await Promise.all([
    chrome.storage.local.get(DEFAULT_SETTINGS),
    chrome.runtime.sendMessage({ type: "youtube-video-filter:get-tab-settings" })
      .catch(() => ({ settings: {} }))
  ]);
  defaultSettings = normalizeSettings(settings);
  tabSettings = tabResponse?.settings ?? {};
  currentSettings = normalizeSettings({ ...defaultSettings, ...tabSettings });
  detailedLogging = currentSettings.detailedLogging;
  resetStatistics(getInactiveStatisticsStatus());
  playerSettingsUi = createPlayerSettingsUi({
    getSettings: () => currentSettings,
    getStatistics: () => currentStatistics,
    onChange: async (changes) => {
      const response = await chrome.runtime.sendMessage({
        type: "youtube-video-filter:set-tab-settings",
        settings: changes
      });
      if (!response?.settings) throw new Error(response?.error || "タブ設定を保存できませんでした");
      tabSettings = response.settings;
      applySettings({}, "tab");
    }
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
  const resetPlayerForNavigation = () => {
    cancelActiveProcessing?.();
    cancelActiveProcessing = null;
    activeVideo = null;
    activeVideoSource = "";
    resetStatistics(getInactiveStatisticsStatus());
  };
  const handleVisibilityChange = () => {
    if (document.visibilityState !== "visible") {
      diagnostic("タブが非表示になったためフィルター処理を停止");
      cancelActiveProcessing?.();
      cancelActiveProcessing = null;
      activeVideo = null;
      activeVideoSource = "";
      updateStatistics({ status: "一時停止中" });
      return;
    }

    diagnostic("タブが表示されたため現在の再生位置からフィルター処理を再開");
    updateStatistics({ status: getInactiveStatisticsStatus() });
    refreshPlayer();
  };
  new MutationObserver(refreshPlayer).observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  window.addEventListener("yt-navigate-finish", refreshPlayer);
  window.addEventListener("yt-navigate-start", resetPlayerForNavigation);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  chrome.runtime.onMessage.addListener(handleExtensionMessage);
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    const relevantChanges = {};
    for (const key of ["enabled", "profile", "colorRangeMode", "detailedLogging", "diagnosticStage"]) {
      if (changes[key]) relevantChanges[key] = changes[key].newValue;
    }
    if (Object.keys(relevantChanges).length > 0) applySettings(relevantChanges, "defaults");
  });
  refreshPlayer();
}

start().catch((error) => report("拡張機能を開始できませんでした", error));
