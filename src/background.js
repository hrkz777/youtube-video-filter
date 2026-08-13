import {
  TAB_SETTING_KEYS,
  TAB_SETTINGS_DEFAULTS,
  sanitizeSettings,
  validateSettingChanges
} from "./settings-schema.js";

const TAB_SETTINGS_PREFIX = "tab-settings:";

function getStorageKey(tabId) {
  return `${TAB_SETTINGS_PREFIX}${tabId}`;
}

function resolveTabId(sender) {
  const tabId = sender.tab?.id;
  return Number.isInteger(tabId) && tabId >= 0 ? tabId : null;
}

function sanitizeOverriddenKeys(keys) {
  if (!Array.isArray(keys)) return [];
  return TAB_SETTING_KEYS.filter((key) => keys.includes(key));
}

function normalizeSessionRecord(storedValue) {
  if (storedValue?.values) {
    const values = sanitizeSettings(storedValue.values, TAB_SETTING_KEYS);
    return {
      values,
      overriddenKeys: sanitizeOverriddenKeys(storedValue.overriddenKeys)
        .filter((key) => Object.hasOwn(values, key))
    };
  }
  return {
    values: sanitizeSettings(storedValue, TAB_SETTING_KEYS),
    overriddenKeys: []
  };
}

async function createDefaultSessionRecord() {
  return {
    values: sanitizeSettings(await chrome.storage.local.get(TAB_SETTINGS_DEFAULTS), TAB_SETTING_KEYS),
    overriddenKeys: []
  };
}

async function getTabSettings(tabId) {
  const key = getStorageKey(tabId);
  const stored = await chrome.storage.session.get(key);
  if (stored[key]) {
    const record = normalizeSessionRecord(stored[key]);
    await chrome.storage.session.set({ [key]: record });
    return record;
  }
  const record = await createDefaultSessionRecord();
  await chrome.storage.session.set({ [key]: record });
  return record;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !message?.type?.startsWith("youtube-video-filter:")) return;
  const tabId = resolveTabId(sender);
  if (tabId === null) {
    sendResponse({ error: "設定対象のタブを特定できません" });
    return;
  }

  if (message.type === "youtube-video-filter:get-tab-settings") {
    getTabSettings(tabId).then((record) => {
      sendResponse({ settings: record.values, overriddenKeys: record.overriddenKeys });
    }).catch((error) => sendResponse({ error: error.message }));
    return true;
  }

  if (message.type === "youtube-video-filter:set-tab-settings") {
    getTabSettings(tabId).then(async (previousRecord) => {
      const changes = validateSettingChanges(message.settings, TAB_SETTING_KEYS);
      const record = {
        values: { ...previousRecord.values, ...changes },
        overriddenKeys: sanitizeOverriddenKeys([
          ...previousRecord.overriddenKeys,
          ...Object.keys(changes)
        ])
      };
      await chrome.storage.session.set({ [getStorageKey(tabId)]: record });
      sendResponse({ settings: record.values, overriddenKeys: record.overriddenKeys });
    }).catch((error) => sendResponse({ error: error.message }));
    return true;
  }

  if (message.type === "youtube-video-filter:reset-tab-settings") {
    createDefaultSessionRecord().then(async (record) => {
      await chrome.storage.session.set({ [getStorageKey(tabId)]: record });
      sendResponse({ settings: record.values, overriddenKeys: [] });
    }).catch((error) => sendResponse({ error: error.message }));
    return true;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(getStorageKey(tabId));
});
