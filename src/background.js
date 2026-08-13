const TAB_SETTINGS_PREFIX = "tab-settings:";
const SESSION_SETTINGS_DEFAULTS = {
  enabled: true,
  profile: "auto",
  colorRangeMode: "none"
};
const SETTINGS_KEYS = Object.keys(SESSION_SETTINGS_DEFAULTS);
const tabOperations = new Map();

function runTabOperation(tabId, operation) {
  const previousOperation = tabOperations.get(tabId) ?? Promise.resolve();
  const currentOperation = previousOperation.catch(() => {}).then(operation);
  tabOperations.set(tabId, currentOperation);
  return currentOperation.finally(() => {
    if (tabOperations.get(tabId) === currentOperation) tabOperations.delete(tabId);
  });
}

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

function sanitizeOverriddenKeys(keys) {
  if (!Array.isArray(keys)) return [];
  return SETTINGS_KEYS.filter((key) => keys.includes(key));
}

function normalizeSessionRecord(storedValue) {
  if (storedValue?.values) {
    return {
      values: sanitizeSettings(storedValue.values),
      overriddenKeys: sanitizeOverriddenKeys(storedValue.overriddenKeys)
    };
  }
  return {
    values: sanitizeSettings(storedValue),
    overriddenKeys: []
  };
}

async function createDefaultSessionRecord() {
  return {
    values: sanitizeSettings(await chrome.storage.local.get(SESSION_SETTINGS_DEFAULTS)),
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
    runTabOperation(tabId, () => getTabSettings(tabId)).then((record) => {
      sendResponse({ settings: record.values, overriddenKeys: record.overriddenKeys });
    }).catch((error) => sendResponse({ error: error.message }));
    return true;
  }

  if (message.type === "youtube-video-filter:set-tab-settings") {
    runTabOperation(tabId, async () => {
      const previousRecord = await getTabSettings(tabId);
      const changes = sanitizeSettings(message.settings);
      const record = {
        values: { ...previousRecord.values, ...changes },
        overriddenKeys: sanitizeOverriddenKeys([
          ...previousRecord.overriddenKeys,
          ...Object.keys(changes)
        ])
      };
      await chrome.storage.session.set({ [getStorageKey(tabId)]: record });
      return record;
    }).then((record) => {
      sendResponse({ settings: record.values, overriddenKeys: record.overriddenKeys });
    }).catch((error) => sendResponse({ error: error.message }));
    return true;
  }

  if (message.type === "youtube-video-filter:reset-tab-settings") {
    runTabOperation(tabId, async () => {
      const record = await createDefaultSessionRecord();
      await chrome.storage.session.set({ [getStorageKey(tabId)]: record });
      return record;
    }).then((record) => {
      sendResponse({ settings: record.values, overriddenKeys: [] });
    }).catch((error) => sendResponse({ error: error.message }));
    return true;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void runTabOperation(tabId, () => chrome.storage.session.remove(getStorageKey(tabId)));
});
