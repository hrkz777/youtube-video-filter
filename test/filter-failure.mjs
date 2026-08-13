import assert from "node:assert/strict";
import {
  createFilterFailureRegistry,
  getFilterCompatibilityError
} from "../src/filter-failure.js";

const settings = {
  enabled: true,
  profile: "v4.1-low-resolution",
  colorRangeMode: "none",
  diagnosticStage: "full",
  detailedLogging: false
};
const video = {
  currentSrc: "blob:https://www.youtube.com/video-a",
  videoHeight: 1080
};

assert.equal(
  getFilterCompatibilityError(video, settings),
  "v4.1低解像度モードは360p以下専用です（現在: 1080p）"
);
assert.equal(getFilterCompatibilityError({ ...video, videoHeight: 360 }, settings), null);
assert.equal(getFilterCompatibilityError(video, { ...settings, enabled: false }), null);
assert.equal(getFilterCompatibilityError(video, { ...settings, profile: "mode-a" }), null);
assert.equal(getFilterCompatibilityError(video, { ...settings, diagnosticStage: "source" }), null);

const registry = createFilterFailureRegistry();
assert.equal(registry.isBlocked(video, settings), false);
registry.block(video, settings);
assert.equal(registry.isBlocked(video, settings), true);

assert.equal(
  registry.isBlocked(video, { ...settings, detailedLogging: true }),
  true,
  "描画に影響しない詳細ログの変更では再試行しない"
);
assert.equal(registry.isBlocked(video, { ...settings, profile: "mode-a" }), false);
assert.equal(registry.isBlocked(video, { ...settings, colorRangeMode: "limited-to-full" }), false);
assert.equal(registry.isBlocked(video, { ...settings, diagnosticStage: "source" }), false);

video.currentSrc = "blob:https://www.youtube.com/video-b";
assert.equal(registry.isBlocked(video, settings), false);
registry.block(video, settings);
registry.clear(video);
assert.equal(registry.isBlocked(video, settings), false);

console.log("フィルター適用失敗時の再試行制御を検証しました。");
