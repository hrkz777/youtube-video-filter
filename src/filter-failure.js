const FILTER_SETTING_KEYS = ["enabled", "profile", "colorRangeMode", "diagnosticStage"];

function createFailureKey(video, settings) {
  return JSON.stringify([
    video.currentSrc,
    ...FILTER_SETTING_KEYS.map((key) => settings[key])
  ]);
}

export function getFilterCompatibilityError(video, settings) {
  if (settings.enabled
    && settings.diagnosticStage === "full"
    && settings.profile === "v4.1-low-resolution"
    && video.videoHeight > 360) {
    return `v4.1低解像度モードは360p以下専用です（現在: ${video.videoHeight}p）`;
  }
  return null;
}

export function createFilterFailureRegistry() {
  const failures = new WeakMap();
  return {
    block(video, settings) {
      failures.set(video, createFailureKey(video, settings));
    },
    clear(video) {
      failures.delete(video);
    },
    isBlocked(video, settings) {
      return failures.get(video) === createFailureKey(video, settings);
    }
  };
}
