import assert from "node:assert/strict";
import { shouldRestartForResize } from "../src/resize-policy.js";

const hd = { width: 1920, height: 1080 };

assert.equal(shouldRestartForResize(hd, { width: 1920, height: 1080 }), false);
assert.equal(shouldRestartForResize(hd, { width: 1923, height: 1083 }), false);
assert.equal(shouldRestartForResize(hd, { width: 1929, height: 1085 }), false);
assert.equal(shouldRestartForResize(hd, { width: 1930, height: 1080 }), true);
assert.equal(shouldRestartForResize(hd, { width: 1920, height: 1086 }), true);
assert.equal(shouldRestartForResize(hd, { width: 3840, height: 2160 }), true);
assert.equal(shouldRestartForResize({ width: 640, height: 360 }, { width: 643, height: 363 }), false);
assert.equal(shouldRestartForResize({ width: 640, height: 360 }, { width: 644, height: 360 }), true);
assert.equal(shouldRestartForResize(hd, { width: 1, height: 1 }), false);
assert.equal(shouldRestartForResize(null, hd), false);

console.log("表示サイズ変更時の再構築判定を検証しました。");
