import {
  CNNx2M,
  CNNSoftM,
  GANUUL,
  GANx4UUL,
  ModeA,
  render
} from "anime4k-webgpu";

const CANVAS_CLASS = "anime4k-for-youtube-canvas";
const VIDEO_CLASS = "anime4k-for-youtube-source";
let activeVideo = null;
let initializationInProgress = false;

function report(message, error) {
  const method = error ? "error" : "info";
  console[method](`[Anime4K for YouTube] ${message}`, error ?? "");
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

  canvas.width = Math.max(1, Math.round(requestedWidth * scale));
  canvas.height = Math.max(1, Math.round(requestedHeight * scale));
}

function createCanvas(video) {
  const canvas = document.createElement("canvas");
  canvas.className = CANVAS_CLASS;
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "absolute",
    inset: "0",
    width: "100%",
    height: "100%",
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

  setCanvasSize(canvas, video);
  container.append(canvas);
  return canvas;
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

async function applyAnime4K(video, profile) {
  if (initializationInProgress || activeVideo === video || !navigator.gpu) {
    if (!navigator.gpu) report("WebGPUが利用できないため、元の映像を表示します");
    return;
  }

  initializationInProgress = true;
  let canvas;
  try {
    video.crossOrigin = "anonymous";
    await waitForVideoMetadata(video);

    if (profile === "v4.1-low-resolution" && video.videoHeight > 360) {
      report(`v4.1低解像度モードは360p以下専用です（現在: ${video.videoHeight}p）。元の映像を表示します`);
      return;
    }

    canvas = createCanvas(video);

    await render({
      video,
      canvas,
      pipelineBuilder: (device, inputTexture) =>
        profile === "v4.1-low-resolution"
          ? buildLowResolutionExperiment(device, inputTexture)
          : buildModeA(device, inputTexture, video, canvas)
    });

    activeVideo = video;
    video.classList.add(VIDEO_CLASS);
    video.style.opacity = "0";
    const appliedMode = profile === "v4.1-low-resolution" ? "v4.1 Low resolution experiment" : "Mode A";
    report(`Anime4K ${appliedMode}を適用しました (${video.videoWidth}x${video.videoHeight} → ${canvas.width}x${canvas.height})`);
  } catch (error) {
    canvas?.remove();
    video.style.removeProperty("opacity");
    video.classList.remove(VIDEO_CLASS);
    report("Anime4Kの初期化に失敗したため、元の映像を表示します", error);
  } finally {
    initializationInProgress = false;
  }
}

function findYouTubeVideo(profile) {
  const video = document.querySelector("#movie_player video.html5-main-video");
  if (video && video !== activeVideo) {
    applyAnime4K(video, profile);
  }
}

async function start() {
  const { enabled, profile } = await chrome.storage.local.get({ enabled: true, profile: "auto" });
  if (!enabled) return;

  const findVideo = () => findYouTubeVideo(profile);
  new MutationObserver(findVideo).observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  window.addEventListener("yt-navigate-finish", findVideo);
  findVideo();
}

start().catch((error) => report("拡張機能を開始できませんでした", error));
