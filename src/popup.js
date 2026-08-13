const enabledInput = document.querySelector("#enabled");
const settingsScopeInput = document.querySelector("#settings-scope");
const scopeNote = document.querySelector("#scope-note");
const profileInput = document.querySelector("#profile");
const colorRangeInput = document.querySelector("#color-range-mode");
const detailedLoggingInput = document.querySelector("#detailed-logging");
const diagnosticContainer = document.querySelector("#diagnostic-container");
const diagnosticStageInput = document.querySelector("#diagnostic-stage");
const saveButton = document.querySelector("#save-button");
const resetTabButton = document.querySelector("#reset-tab-button");
const status = document.querySelector("#status");
const modeNote = document.querySelector("#mode-note");

const MODE_NOTES = {
  auto: "自動では安定性を優先し、Mode Aを使用します。",
  "mode-a": "一般的な720p・1080pアニメ向けの復元・アップスケールです。",
  "mode-b": "比較的劣化の少ない720p・1080pアニメ向けです。",
  "mode-c": "低劣化素材向けで、ノイズを抑えながら拡大します。",
  "mode-aa": "Mode Aの二段構成です。2倍以上の拡大向けでGPU負荷が高くなります。",
  "mode-bb": "Mode Bの二段構成です。2倍以上の拡大向けでGPU負荷が高くなります。",
  "mode-ac": "Mode Aの出力をMode Cへ渡すカスタム構成です。GPU負荷が高くなります。",
  "v4.1-low-resolution": "実験的な360p以下専用モードです。非常に高いGPU性能とVRAMを必要とします。"
};
const DIAGNOSTIC_STAGES = new Set(["full", "source", "clamp", "restore"]);
const DEFAULT_SETTINGS = {
  enabled: true,
  profile: "auto",
  colorRangeMode: "none",
  detailedLogging: false,
  diagnosticStage: "full"
};
let activeYouTubeTabId = null;

function setFormValues(settings) {
  enabledInput.checked = settings.enabled;
  profileInput.value = settings.profile;
  colorRangeInput.value = settings.colorRangeMode;
  detailedLoggingInput.checked = settings.detailedLogging;
  diagnosticStageInput.value = DIAGNOSTIC_STAGES.has(settings.diagnosticStage)
    ? settings.diagnosticStage
    : "full";
  diagnosticContainer.hidden = !settings.detailedLogging;
  modeNote.textContent = MODE_NOTES[settings.profile];
}

async function getDefaultSettings() {
  return chrome.storage.local.get(DEFAULT_SETTINGS);
}

async function sendToActiveTab(type, settings) {
  if (activeYouTubeTabId === null) throw new Error("設定対象のYouTubeタブがありません");
  const response = await chrome.runtime.sendMessage({
    type,
    tabId: activeYouTubeTabId,
    settings
  });
  if (response?.error) throw new Error(response.error);
  return response;
}

async function loadSelectedScope() {
  status.textContent = "";
  const tabScope = settingsScopeInput.value === "tab";
  resetTabButton.hidden = !tabScope;
  scopeNote.textContent = tabScope
    ? "このタブだけに適用します。タブを閉じると設定は破棄されます。"
    : "新しく開くタブと、タブ固有設定で上書きしていない項目に適用します。";
  if (tabScope) {
    const [defaults, response] = await Promise.all([
      getDefaultSettings(),
      sendToActiveTab("youtube-video-filter:get-tab-settings")
    ]);
    setFormValues({ ...defaults, ...response.settings });
    resetTabButton.disabled = response.overriddenKeys.length === 0;
  } else {
    setFormValues(await getDefaultSettings());
  }
}

async function initialize() {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab?.id !== undefined && activeTab.url?.startsWith("https://www.youtube.com/")) {
    activeYouTubeTabId = activeTab.id;
  } else {
    settingsScopeInput.value = "defaults";
    settingsScopeInput.querySelector('option[value="tab"]').disabled = true;
  }
  await loadSelectedScope();
}

function setFormDisabled(disabled) {
  enabledInput.disabled = disabled;
  profileInput.disabled = disabled;
  colorRangeInput.disabled = disabled;
  detailedLoggingInput.disabled = disabled;
  diagnosticStageInput.disabled = disabled;
  saveButton.disabled = disabled;
  resetTabButton.disabled = disabled;
}

function getFormSettings() {
  return {
    enabled: enabledInput.checked,
    profile: profileInput.value,
    colorRangeMode: colorRangeInput.value,
    detailedLogging: detailedLoggingInput.checked,
    diagnosticStage: detailedLoggingInput.checked ? diagnosticStageInput.value : "full"
  };
}

async function saveSettings() {
  setFormDisabled(true);
  try {
    const settings = getFormSettings();
    if (settingsScopeInput.value === "tab") {
      await sendToActiveTab("youtube-video-filter:set-tab-settings", settings);
      resetTabButton.disabled = false;
    } else {
      await chrome.storage.local.set(settings);
    }
    status.style.color = "green";
    status.textContent = "設定を保存しました";
  } finally {
    setFormDisabled(false);
  }
}

settingsScopeInput.addEventListener("change", () => {
  loadSelectedScope().catch((error) => {
    status.style.color = "red";
    status.textContent = `設定を読み込めませんでした: ${error.message}`;
  });
});

resetTabButton.addEventListener("click", () => {
  setFormDisabled(true);
  sendToActiveTab("youtube-video-filter:clear-tab-settings")
    .then(async () => {
      setFormValues(await getDefaultSettings());
      status.style.color = "green";
      status.textContent = "このタブを既定値へ戻しました";
    })
    .catch((error) => {
      status.style.color = "red";
      status.textContent = `設定を戻せませんでした: ${error.message}`;
    })
    .finally(() => {
      setFormDisabled(false);
      resetTabButton.disabled = true;
    });
});

profileInput.addEventListener("change", () => {
  modeNote.textContent = MODE_NOTES[profileInput.value];
});

detailedLoggingInput.addEventListener("change", () => {
  diagnosticContainer.hidden = !detailedLoggingInput.checked;
});

saveButton.addEventListener("click", () => {
  saveSettings().catch((error) => {
    status.style.color = "red";
    status.textContent = `設定を保存できませんでした: ${error.message}`;
  });
});

initialize().catch((error) => {
  status.textContent = `設定を読み込めませんでした: ${error.message}`;
});
