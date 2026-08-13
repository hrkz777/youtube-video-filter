const schema = Object.freeze({
  enabled: Object.freeze({ defaultValue: true, values: Object.freeze([true, false]) }),
  profile: Object.freeze({
    defaultValue: "auto",
    values: Object.freeze([
      "auto",
      "mode-a",
      "mode-b",
      "mode-c",
      "mode-aa",
      "mode-bb",
      "mode-ac",
      "v4.1-low-resolution"
    ])
  }),
  colorRangeMode: Object.freeze({
    defaultValue: "none",
    values: Object.freeze(["none", "limited-to-full", "full-to-limited"])
  }),
  detailedLogging: Object.freeze({ defaultValue: false, values: Object.freeze([true, false]) }),
  diagnosticStage: Object.freeze({
    defaultValue: "full",
    values: Object.freeze(["full", "source", "clamp", "restore"])
  })
});

export const SETTINGS_KEYS = Object.freeze(Object.keys(schema));
export const TAB_SETTING_KEYS = Object.freeze(["enabled", "profile", "colorRangeMode"]);
export const DEFAULT_SETTINGS = Object.freeze(Object.fromEntries(
  SETTINGS_KEYS.map((key) => [key, schema[key].defaultValue])
));
export const TAB_SETTINGS_DEFAULTS = Object.freeze(Object.fromEntries(
  TAB_SETTING_KEYS.map((key) => [key, schema[key].defaultValue])
));

export function isValidSettingValue(key, value) {
  return Object.hasOwn(schema, key) && schema[key].values.includes(value);
}

export function sanitizeSettings(settings, allowedKeys = SETTINGS_KEYS) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return {};
  return Object.fromEntries(
    allowedKeys
      .filter((key) => Object.hasOwn(settings, key) && isValidSettingValue(key, settings[key]))
      .map((key) => [key, settings[key]])
  );
}

export function normalizeSettings(settings) {
  return { ...DEFAULT_SETTINGS, ...sanitizeSettings(settings) };
}

export function validateSettingChanges(settings, allowedKeys = SETTINGS_KEYS) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    throw new TypeError("設定変更はオブジェクトで指定してください");
  }
  const invalidKeys = allowedKeys.filter(
    (key) => Object.hasOwn(settings, key) && !isValidSettingValue(key, settings[key])
  );
  if (invalidKeys.length > 0) {
    throw new TypeError(`不正な設定値です: ${invalidKeys.join(", ")}`);
  }
  return sanitizeSettings(settings, allowedKeys);
}
