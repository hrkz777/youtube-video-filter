import assert from "node:assert/strict";
import {
  DEFAULT_SETTINGS,
  TAB_SETTING_KEYS,
  TAB_SETTINGS_DEFAULTS,
  VIDEO_ADJUSTMENT_DEFINITIONS,
  VIDEO_ADJUSTMENT_KEYS,
  hasVideoAdjustments,
  isValidSettingValue,
  normalizeSettings,
  sanitizeSettings,
  validateSettingChanges
} from "../src/settings-schema.js";

assert.deepEqual(DEFAULT_SETTINGS, {
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
});
assert.deepEqual(TAB_SETTING_KEYS, [
  "enabled",
  "profile",
  "colorRangeMode",
  "brightness",
  "contrast",
  "saturation",
  "gamma",
  "hue"
]);
assert.deepEqual(TAB_SETTINGS_DEFAULTS, {
  enabled: true,
  profile: "auto",
  colorRangeMode: "none",
  brightness: 0,
  contrast: 0,
  saturation: 0,
  gamma: 100,
  hue: 0
});
assert.deepEqual(VIDEO_ADJUSTMENT_KEYS, [
  "brightness",
  "contrast",
  "saturation",
  "gamma",
  "hue"
]);
assert.deepEqual(VIDEO_ADJUSTMENT_DEFINITIONS.brightness, {
  defaultValue: 0,
  minimum: -100,
  maximum: 100,
  step: 1
});

assert.equal(isValidSettingValue("profile", "mode-c"), true);
assert.equal(isValidSettingValue("profile", "mode-ca"), true);
assert.equal(isValidSettingValue("profile", "mode-ac"), true);
assert.equal(isValidSettingValue("profile", "invalid"), false);
assert.equal(isValidSettingValue("enabled", 1), false);
assert.equal(isValidSettingValue("brightness", -100), true);
assert.equal(isValidSettingValue("brightness", 100), true);
assert.equal(isValidSettingValue("contrast", 25), true);
assert.equal(isValidSettingValue("brightness", 100.5), false);
assert.equal(isValidSettingValue("contrast", Number.NaN), false);
assert.equal(isValidSettingValue("contrast", 101), false);
assert.equal(isValidSettingValue("saturation", -100), true);
assert.equal(isValidSettingValue("gamma", 10), true);
assert.equal(isValidSettingValue("gamma", 300), true);
assert.equal(isValidSettingValue("gamma", 0), false);
assert.equal(isValidSettingValue("hue", -180), true);
assert.equal(isValidSettingValue("hue", 181), false);
assert.equal(hasVideoAdjustments(DEFAULT_SETTINGS), false);
assert.equal(hasVideoAdjustments({ ...DEFAULT_SETTINGS, saturation: 1 }), true);
assert.equal(hasVideoAdjustments({ ...DEFAULT_SETTINGS, gamma: 99 }), true);
assert.equal(hasVideoAdjustments({ ...DEFAULT_SETTINGS, hue: -1 }), true);
assert.deepEqual(normalizeSettings({ profile: "invalid", detailedLogging: true }), {
  ...DEFAULT_SETTINGS,
  detailedLogging: true
});
assert.equal(normalizeSettings({ profile: "mode-ac" }).profile, "mode-ca");
assert.deepEqual(
  sanitizeSettings({ enabled: false, detailedLogging: true }, TAB_SETTING_KEYS),
  { enabled: false }
);
assert.deepEqual(
  validateSettingChanges({ profile: "mode-b", unknownSetting: "ignored" }, TAB_SETTING_KEYS),
  { profile: "mode-b" }
);
assert.deepEqual(
  validateSettingChanges({ profile: "mode-ac" }, TAB_SETTING_KEYS),
  { profile: "mode-ca" }
);
assert.throws(
  () => validateSettingChanges({ profile: "invalid" }, TAB_SETTING_KEYS),
  /不正な設定値です: profile/
);
assert.throws(
  () => validateSettingChanges({ brightness: -101, contrast: "10" }, TAB_SETTING_KEYS),
  /不正な設定値です: brightness, contrast/
);
assert.throws(
  () => validateSettingChanges(null, TAB_SETTING_KEYS),
  /設定変更はオブジェクトで指定してください/
);

console.log("設定スキーマの正規化と検証に成功しました。");
