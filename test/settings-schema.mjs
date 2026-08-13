import assert from "node:assert/strict";
import {
  DEFAULT_SETTINGS,
  TAB_SETTING_KEYS,
  TAB_SETTINGS_DEFAULTS,
  isValidSettingValue,
  normalizeSettings,
  sanitizeSettings,
  validateSettingChanges
} from "../src/settings-schema.js";

assert.deepEqual(DEFAULT_SETTINGS, {
  enabled: true,
  profile: "auto",
  colorRangeMode: "none",
  detailedLogging: false,
  diagnosticStage: "full"
});
assert.deepEqual(TAB_SETTING_KEYS, ["enabled", "profile", "colorRangeMode"]);
assert.deepEqual(TAB_SETTINGS_DEFAULTS, {
  enabled: true,
  profile: "auto",
  colorRangeMode: "none"
});

assert.equal(isValidSettingValue("profile", "mode-c"), true);
assert.equal(isValidSettingValue("profile", "invalid"), false);
assert.equal(isValidSettingValue("enabled", 1), false);
assert.deepEqual(normalizeSettings({ profile: "invalid", detailedLogging: true }), {
  ...DEFAULT_SETTINGS,
  detailedLogging: true
});
assert.deepEqual(
  sanitizeSettings({ enabled: false, detailedLogging: true }, TAB_SETTING_KEYS),
  { enabled: false }
);
assert.deepEqual(
  validateSettingChanges({ profile: "mode-b", unknownSetting: "ignored" }, TAB_SETTING_KEYS),
  { profile: "mode-b" }
);
assert.throws(
  () => validateSettingChanges({ profile: "invalid" }, TAB_SETTING_KEYS),
  /不正な設定値です: profile/
);
assert.throws(
  () => validateSettingChanges(null, TAB_SETTING_KEYS),
  /設定変更はオブジェクトで指定してください/
);

console.log("設定スキーマの正規化と検証に成功しました。");
