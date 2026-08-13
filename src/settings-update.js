const isFilterActive = (settings) => settings.enabled || settings.colorRangeMode !== "none";

export function getSettingsUpdateAction(previous, current, canUpdateColorRange) {
  const wasActive = isFilterActive(previous);
  const isActive = isFilterActive(current);
  if (!isActive) return wasActive ? "stop" : "none";

  if (previous.enabled !== current.enabled) return "restart";
  if (current.enabled
    && (previous.profile !== current.profile
      || previous.diagnosticStage !== current.diagnosticStage)) {
    return "restart";
  }
  if (previous.colorRangeMode !== current.colorRangeMode) {
    return canUpdateColorRange ? "update-color-range" : "restart";
  }
  return "none";
}
