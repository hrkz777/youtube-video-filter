import assert from "node:assert/strict";
import {
  getRemainingPreviewSettings,
  getSettingsUpdateAction
} from "../src/settings-update.js";

const base = {
  enabled: true,
  profile: "auto",
  colorRangeMode: "none",
  brightness: 0,
  contrast: 0,
  saturation: 0,
  gamma: 100,
  hue: 0,
  detailedLogging: false,
  diagnosticStage: "full"
};

assert.equal(getSettingsUpdateAction(base, { ...base }, true), "none");
assert.equal(
  getSettingsUpdateAction(base, { ...base, detailedLogging: true }, true),
  "none"
);

assert.deepEqual(
  getRemainingPreviewSettings(
    { brightness: 20, contrast: -10 },
    { brightness: 10 }
  ),
  { brightness: 20, contrast: -10 },
  "古い保存応答では新しいプレビューを破棄しない"
);
assert.deepEqual(
  getRemainingPreviewSettings(
    { brightness: 20, contrast: -10 },
    { brightness: 20 }
  ),
  { contrast: -10 },
  "保存された値と一致するプレビューだけを確定扱いにする"
);
assert.equal(
  getSettingsUpdateAction(base, { ...base, colorRangeMode: "limited-to-full" }, true),
  "update-display-settings"
);
assert.equal(
  getSettingsUpdateAction(base, { ...base, brightness: 20 }, true),
  "update-display-settings"
);
assert.equal(
  getSettingsUpdateAction(base, { ...base, contrast: -20 }, false),
  "restart"
);
for (const changes of [{ saturation: 20 }, { gamma: 120 }, { hue: -30 }]) {
  assert.equal(
    getSettingsUpdateAction(base, { ...base, ...changes }, true),
    "update-display-settings"
  );
}
assert.equal(
  getSettingsUpdateAction(base, { ...base, colorRangeMode: "limited-to-full" }, false),
  "restart"
);
assert.equal(
  getSettingsUpdateAction(base, { ...base, profile: "mode-c" }, true),
  "restart"
);
assert.equal(
  getSettingsUpdateAction(base, { ...base, diagnosticStage: "source" }, true),
  "restart"
);
assert.equal(
  getSettingsUpdateAction(base, { ...base, enabled: false }, true),
  "stop"
);
assert.equal(
  getSettingsUpdateAction(base, { ...base, enabled: false, colorRangeMode: "full-to-limited" }, true),
  "restart"
);

const colorOnly = { ...base, enabled: false, colorRangeMode: "limited-to-full" };
assert.equal(
  getSettingsUpdateAction(colorOnly, { ...colorOnly, profile: "mode-c" }, true),
  "none"
);
assert.equal(
  getSettingsUpdateAction(
    { ...base, enabled: false },
    { ...base, enabled: false, brightness: 10 },
    false
  ),
  "restart"
);
assert.equal(
  getSettingsUpdateAction(
    { ...base, enabled: false },
    { ...base, enabled: false, profile: "mode-c" },
    false
  ),
  "none"
);
assert.equal(
  getSettingsUpdateAction(
    { ...base, enabled: false },
    { ...base, enabled: false, colorRangeMode: "limited-to-full" },
    false
  ),
  "restart"
);

console.log("設定別の更新経路を検証しました。");
