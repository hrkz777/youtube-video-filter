const TAB_SETTINGS_PREFIX = "tab-settings:";
const SETTINGS_KEYS = ["enabled", "profile", "colorRangeMode", "detailedLogging", "diagnosticStage"];

function getStorageKey(tabId) {
  return `${TAB_SETTINGS_PREFIX}${tabId}`;
}

function resolveTabId(message, sender) {
  const tabId = sender.tab?.id ?? message.tabId;
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
  const stored = await chrome.storage.session.get({ [key]: {} });
  return sanitizeSettings(stored[key]);
}

async function notifyTab(tabId, settings) {
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "youtube-video-filter:apply-tab-settings",
      settings
    });
  } catch {
    // Content Scriptの読み込み前やYouTube以外のページでは、保存だけを完了する。
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !message?.type?.startsWith("youtube-video-filter:")) return;
  const tabId = resolveTabId(message, sender);
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
      if (sender.tab?.id !== tabId) await notifyTab(tabId, settings);
      sendResponse({ settings, overriddenKeys: Object.keys(settings) });
    }).catch((error) => sendResponse({ error: error.message }));
    return true;
  }

  if (message.type === "youtube-video-filter:clear-tab-settings") {
    chrome.storage.session.remove(getStorageKey(tabId)).then(async () => {
      await notifyTab(tabId, {});
      sendResponse({ settings: {}, overriddenKeys: [] });
    }).catch((error) => sendResponse({ error: error.message }));
    return true;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(getStorageKey(tabId));
});
