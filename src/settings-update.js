const isFilterActive = (settings) => settings.enabled
  || settings.colorRangeMode !== "none"
  || settings.brightness !== 0
  || settings.contrast !== 0;

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
    || previous.brightness !== current.brightness
    || previous.contrast !== current.contrast) {
    return canUpdateDisplaySettings ? "update-display-settings" : "restart";
  }
  return "none";
}
