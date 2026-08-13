export const ANIME4K_OFF_VALUE = "off";

export function getAnime4kSelection(settings) {
  return settings.enabled === false ? ANIME4K_OFF_VALUE : settings.profile ?? "auto";
}

export function getAnime4kChanges(selection) {
  return selection === ANIME4K_OFF_VALUE
    ? { enabled: false }
    : { enabled: true, profile: selection };
}

export function getAnime4kStorageValues(selection, preservedProfile = "auto") {
  const changes = getAnime4kChanges(selection);
  return {
    enabled: changes.enabled,
    profile: changes.profile ?? preservedProfile
  };
}

export function isAnime4kOverridden(overriddenKeys = []) {
  return overriddenKeys.includes("enabled") || overriddenKeys.includes("profile");
}
