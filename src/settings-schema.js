export const VIDEO_ADJUSTMENT_DEFINITIONS = Object.freeze({
  brightness: Object.freeze({ defaultValue: 0, minimum: -100, maximum: 100, step: 1 }),
  contrast: Object.freeze({ defaultValue: 0, minimum: -100, maximum: 100, step: 1 }),
  saturation: Object.freeze({ defaultValue: 0, minimum: -100, maximum: 100, step: 1 }),
  gamma: Object.freeze({ defaultValue: 100, minimum: 10, maximum: 300, step: 1 }),
  hue: Object.freeze({ defaultValue: 0, minimum: -180, maximum: 180, step: 1 })
});
export const VIDEO_ADJUSTMENT_KEYS = Object.freeze(Object.keys(VIDEO_ADJUSTMENT_DEFINITIONS));

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
      "mode-ca",
      "v4.1-low-resolution"
    ])
  }),
  colorRangeMode: Object.freeze({
    defaultValue: "none",
    values: Object.freeze(["none", "limited-to-full", "full-to-limited"])
  }),
  brightness: VIDEO_ADJUSTMENT_DEFINITIONS.brightness,
  contrast: VIDEO_ADJUSTMENT_DEFINITIONS.contrast,
  saturation: VIDEO_ADJUSTMENT_DEFINITIONS.saturation,
  gamma: VIDEO_ADJUSTMENT_DEFINITIONS.gamma,
  hue: VIDEO_ADJUSTMENT_DEFINITIONS.hue,
  detailedLogging: Object.freeze({ defaultValue: false, values: Object.freeze([true, false]) }),
  diagnosticStage: Object.freeze({
    defaultValue: "full",
    values: Object.freeze(["full", "source", "clamp", "restore"])
  })
});

const legacySettingValueAliases = Object.freeze({
  profile: Object.freeze({ "mode-ac": "mode-ca" })
});

function getCanonicalSettingValue(key, value) {
  const aliases = legacySettingValueAliases[key];
  return aliases && Object.hasOwn(aliases, value) ? aliases[value] : value;
}

export const SETTINGS_KEYS = Object.freeze(Object.keys(schema));
export const TAB_SETTING_KEYS = Object.freeze([
  "enabled",
  "profile",
  "colorRangeMode",
  ...VIDEO_ADJUSTMENT_KEYS
]);
export const DEFAULT_SETTINGS = Object.freeze(Object.fromEntries(
  SETTINGS_KEYS.map((key) => [key, schema[key].defaultValue])
));
export const TAB_SETTINGS_DEFAULTS = Object.freeze(Object.fromEntries(
  TAB_SETTING_KEYS.map((key) => [key, schema[key].defaultValue])
));

export function isValidSettingValue(key, value) {
  if (!Object.hasOwn(schema, key)) return false;
  const definition = schema[key];
  if (definition.values) {
    return definition.values.includes(getCanonicalSettingValue(key, value));
  }
  return Number.isFinite(value)
    && value >= definition.minimum
    && value <= definition.maximum
    && Number.isInteger((value - definition.minimum) / definition.step);
}

export function sanitizeSettings(settings, allowedKeys = SETTINGS_KEYS) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return {};
  return Object.fromEntries(
    allowedKeys
      .filter((key) => Object.hasOwn(settings, key) && isValidSettingValue(key, settings[key]))
      .map((key) => [key, getCanonicalSettingValue(key, settings[key])])
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

export function hasVideoAdjustments(settings) {
  return VIDEO_ADJUSTMENT_KEYS.some((key) => (
    (settings?.[key] ?? VIDEO_ADJUSTMENT_DEFINITIONS[key].defaultValue)
      !== VIDEO_ADJUSTMENT_DEFINITIONS[key].defaultValue
  ));
}
