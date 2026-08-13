import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = await readFile("src/background.js", "utf8");
const localSettings = {
  enabled: true,
  profile: "auto",
  colorRangeMode: "none"
};
const sessionSettings = new Map();
let messageListener;
let tabRemovedListener;

const clone = (value) => structuredClone(value);
const chrome = {
  runtime: {
    id: "youtube-video-filter-test",
    onMessage: {
      addListener(listener) {
        messageListener = listener;
      }
    }
  },
  storage: {
    local: {
      async get(defaults) {
        return { ...defaults, ...clone(localSettings) };
      }
    },
    session: {
      async get(key) {
        return sessionSettings.has(key) ? { [key]: clone(sessionSettings.get(key)) } : {};
      },
      async set(values) {
        for (const [key, value] of Object.entries(values)) sessionSettings.set(key, clone(value));
      },
      async remove(key) {
        sessionSettings.delete(key);
      }
    }
  },
  tabs: {
    onRemoved: {
      addListener(listener) {
        tabRemovedListener = listener;
      }
    }
  }
};

vm.runInNewContext(source, { chrome }, { filename: "src/background.js" });
assert.equal(typeof messageListener, "function");
assert.equal(typeof tabRemovedListener, "function");

function sendMessage(type, tabId, settings) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`${type}の応答がありません`)), 1000);
    const sendResponse = (response) => {
      clearTimeout(timeout);
      resolve(clone(response));
    };
    const keepChannelOpen = messageListener(
      { type, ...(settings ? { settings } : {}) },
      { id: chrome.runtime.id, tab: { id: tabId } },
      sendResponse
    );
    assert.equal(keepChannelOpen, true);
  });
}

const initial = await sendMessage("youtube-video-filter:get-tab-settings", 1);
assert.deepEqual(initial, {
  settings: localSettings,
  overriddenKeys: []
});

const sameValueOverride = await sendMessage("youtube-video-filter:set-tab-settings", 1, {
  profile: "auto"
});
assert.deepEqual(sameValueOverride.overriddenKeys, ["profile"]);

const multipleOverrides = await sendMessage("youtube-video-filter:set-tab-settings", 1, {
  enabled: false,
  unknownSetting: "ignored"
});
assert.deepEqual(multipleOverrides, {
  settings: {
    enabled: false,
    profile: "auto",
    colorRangeMode: "none"
  },
  overriddenKeys: ["enabled", "profile"]
});

localSettings.enabled = false;
localSettings.profile = "mode-c";
localSettings.colorRangeMode = "limited-to-full";

const preservedSession = await sendMessage("youtube-video-filter:get-tab-settings", 1);
assert.deepEqual(preservedSession, multipleOverrides);

const secondTab = await sendMessage("youtube-video-filter:get-tab-settings", 2);
assert.deepEqual(secondTab, {
  settings: localSettings,
  overriddenKeys: []
});

const reset = await sendMessage("youtube-video-filter:reset-tab-settings", 1);
assert.deepEqual(reset, {
  settings: localSettings,
  overriddenKeys: []
});

sessionSettings.set("tab-settings:3", {
  enabled: true,
  profile: "mode-a",
  colorRangeMode: "full-to-limited"
});
const migrated = await sendMessage("youtube-video-filter:get-tab-settings", 3);
assert.deepEqual(migrated, {
  settings: {
    enabled: true,
    profile: "mode-a",
    colorRangeMode: "full-to-limited"
  },
  overriddenKeys: []
});
assert.deepEqual(sessionSettings.get("tab-settings:3"), {
  values: migrated.settings,
  overriddenKeys: []
});

tabRemovedListener(2);
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(sessionSettings.has("tab-settings:2"), false);

console.log("タブ別設定の動作検証に成功しました。");
