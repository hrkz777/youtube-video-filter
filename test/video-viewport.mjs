import assert from "node:assert/strict";
import { getVideoBackingSize } from "../src/video-viewport.js";

assert.deepEqual(getVideoBackingSize({
  sourceWidth: 1920,
  sourceHeight: 1080,
  boxWidth: 853.33,
  boxHeight: 480,
  objectFit: "contain",
  pixelRatio: 1.25
}), { width: 1072, height: 603 });

assert.deepEqual(getVideoBackingSize({
  sourceWidth: 1440,
  sourceHeight: 1080,
  boxWidth: 1280,
  boxHeight: 720,
  objectFit: "contain",
  pixelRatio: 1
}), { width: 960, height: 720 });

assert.deepEqual(getVideoBackingSize({
  sourceWidth: 1440,
  sourceHeight: 1080,
  boxWidth: 1280,
  boxHeight: 720,
  objectFit: "cover",
  pixelRatio: 1
}), { width: 1280, height: 960 });

assert.deepEqual(getVideoBackingSize({
  sourceWidth: 1920,
  sourceHeight: 1080,
  boxWidth: 1000,
  boxHeight: 1000,
  objectFit: "fill",
  pixelRatio: 1.5
}), { width: 1500, height: 1500 });

assert.deepEqual(getVideoBackingSize({
  sourceWidth: 640,
  sourceHeight: 480,
  boxWidth: 1280,
  boxHeight: 720,
  objectFit: "none",
  pixelRatio: 2
}), { width: 640, height: 480 });

assert.deepEqual(getVideoBackingSize({
  sourceWidth: 640,
  sourceHeight: 480,
  boxWidth: 1280,
  boxHeight: 720,
  objectFit: "scale-down",
  pixelRatio: 2
}), { width: 640, height: 480 });

assert.deepEqual(getVideoBackingSize({
  sourceWidth: 7680,
  sourceHeight: 4320,
  boxWidth: 3840,
  boxHeight: 2160,
  objectFit: "contain",
  pixelRatio: 2
}), { width: 4096, height: 2304 });

assert.deepEqual(getVideoBackingSize({
  sourceWidth: 0,
  sourceHeight: 0,
  boxWidth: 1280,
  boxHeight: 720
}), { width: 1, height: 1 });

console.log("動画表示領域と同じアスペクト比のCanvas寸法を検証しました。");
