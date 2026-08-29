import assert from "node:assert/strict";
import { getSettingsUpdateAction } from "../src/settings-update.js";

const base = {
  enabled: true,
  profile: "auto",
  colorRangeMode: "none",
  brightness: 0,
  contrast: 0,
  detailedLogging: false,
  diagnosticStage: "full"
};

assert.equal(getSettingsUpdateAction(base, { ...base }, true), "none");
assert.equal(
  getSettingsUpdateAction(base, { ...base, detailedLogging: true }, true),
  "none"
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
