const TAB_SETTINGS_PREFIX = "tab-settings:";
const SESSION_SETTINGS_DEFAULTS = {
  enabled: true,
  profile: "auto",
  colorRangeMode: "none"
};
const SETTINGS_KEYS = Object.keys(SESSION_SETTINGS_DEFAULTS);

function getStorageKey(tabId) {
  return `${TAB_SETTINGS_PREFIX}${tabId}`;
}

function resolveTabId(sender) {
  const tabId = sender.tab?.id;
  return Number.isInteger(tabId) && tabId >= 0 ? tabId : null;
}

function sanitizeSettings(settings) {
  return Object.fromEntries(
    SETTINGS_KEYS.filter((key) => Object.hasOwn(settings ?? {}, key))
      .map((key) => [key, settings[key]])
  );
}

async function getTabSettings(tabId) {
  const key = getStorageKey(tabId);
  const stored = await chrome.storage.session.get(key);
  if (stored[key]) return sanitizeSettings(stored[key]);
  const defaults = sanitizeSettings(await chrome.storage.local.get(SESSION_SETTINGS_DEFAULTS));
  await chrome.storage.session.set({ [key]: defaults });
  return defaults;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !message?.type?.startsWith("youtube-video-filter:")) return;
  const tabId = resolveTabId(sender);
  if (tabId === null) {
    sendResponse({ error: "設定対象のタブを特定できません" });
    return;
  }

  if (message.type === "youtube-video-filter:get-tab-settings") {
    getTabSettings(tabId).then((settings) => {
      sendResponse({ settings, overriddenKeys: Object.keys(settings) });
    }).catch((error) => sendResponse({ error: error.message }));
    return true;
  }

  if (message.type === "youtube-video-filter:set-tab-settings") {
    getTabSettings(tabId).then(async (previousSettings) => {
      const settings = { ...previousSettings, ...sanitizeSettings(message.settings) };
      await chrome.storage.session.set({ [getStorageKey(tabId)]: settings });
      sendResponse({ settings, overriddenKeys: Object.keys(settings) });
    }).catch((error) => sendResponse({ error: error.message }));
    return true;
  }

});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(getStorageKey(tabId));
});
