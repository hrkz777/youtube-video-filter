import assert from "node:assert/strict";
import { getSettingsUpdateAction } from "../src/settings-update.js";

const base = {
  enabled: true,
  profile: "auto",
  colorRangeMode: "none",
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
  "update-color-range"
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
