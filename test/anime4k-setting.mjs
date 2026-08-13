import assert from "node:assert/strict";
import {
  getAnime4kChanges,
  getAnime4kSelection,
  getAnime4kStorageValues,
  isAnime4kOverridden
} from "../src/anime4k-setting.js";

assert.equal(getAnime4kSelection({ enabled: false, profile: "mode-c" }), "off");
assert.equal(getAnime4kSelection({ enabled: true, profile: "mode-c" }), "mode-c");
assert.equal(getAnime4kSelection({ enabled: true }), "auto");

assert.deepEqual(getAnime4kChanges("off"), { enabled: false });
assert.deepEqual(getAnime4kChanges("mode-a"), { enabled: true, profile: "mode-a" });
assert.deepEqual(
  getAnime4kStorageValues("off", "mode-c"),
  { enabled: false, profile: "mode-c" }
);
assert.deepEqual(
  getAnime4kStorageValues("mode-b", "mode-c"),
  { enabled: true, profile: "mode-b" }
);
assert.deepEqual(
  getAnime4kStorageValues("off"),
  { enabled: false, profile: "auto" }
);

assert.equal(isAnime4kOverridden([]), false);
assert.equal(isAnime4kOverridden(["enabled"]), true);
assert.equal(isAnime4kOverridden(["profile"]), true);
assert.equal(isAnime4kOverridden(), false);

console.log("Anime4K統合設定の変換を検証しました。");
