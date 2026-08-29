import { VIDEO_ADJUSTMENT_KEYS, hasVideoAdjustments } from "./settings-schema.js";

const isFilterActive = (settings) => settings.enabled
  || settings.colorRangeMode !== "none"
  || hasVideoAdjustments(settings);

export function getSettingsUpdateAction(previous, current, canUpdateDisplaySettings) {
  const wasActive = isFilterActive(previous);
  const isActive = isFilterActive(current);
  if (!isActive) return wasActive ? "stop" : "none";

  if (previous.enabled !== current.enabled) return "restart";
  if (current.enabled
    && (previous.profile !== current.profile
      || previous.diagnosticStage !== current.diagnosticStage)) {
    return "restart";
  }
  if (previous.colorRangeMode !== current.colorRangeMode
    || VIDEO_ADJUSTMENT_KEYS.some((key) => previous[key] !== current[key])) {
    return canUpdateDisplaySettings ? "update-display-settings" : "restart";
  }
  return "none";
}

export function getRemainingPreviewSettings(previewSettings, settledChanges) {
  return Object.fromEntries(
    Object.entries(previewSettings).filter(
      ([key, value]) => !Object.hasOwn(settledChanges, key) || settledChanges[key] !== value
    )
  );
}
