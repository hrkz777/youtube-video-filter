import {
  ANIME4K_OFF_VALUE,
  getAnime4kSelection,
  getAnime4kStorageValues
} from "./anime4k-setting.js";

const anime4kModeInput = document.querySelector("#anime4k-mode");
const colorRangeInput = document.querySelector("#color-range-mode");
const detailedLoggingInput = document.querySelector("#detailed-logging");
const diagnosticContainer = document.querySelector("#diagnostic-container");
const diagnosticStageInput = document.querySelector("#diagnostic-stage");
const saveButton = document.querySelector("#save-button");
const status = document.querySelector("#status");
const modeNote = document.querySelector("#mode-note");

const MODE_NOTES = {
  off: "Anime4Kは適用しません。カラーレンジ変換は個別に使用できます。",
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
let preservedProfile = DEFAULT_SETTINGS.profile;

function setFormValues(settings) {
  preservedProfile = settings.profile;
  anime4kModeInput.value = getAnime4kSelection(settings);
  colorRangeInput.value = settings.colorRangeMode;
  detailedLoggingInput.checked = settings.detailedLogging;
  diagnosticStageInput.value = DIAGNOSTIC_STAGES.has(settings.diagnosticStage)
    ? settings.diagnosticStage
    : "full";
  diagnosticContainer.hidden = !settings.detailedLogging;
  modeNote.textContent = MODE_NOTES[anime4kModeInput.value];
}

async function initialize() {
  setFormValues(await chrome.storage.local.get(DEFAULT_SETTINGS));
}

function setFormDisabled(disabled) {
  anime4kModeInput.disabled = disabled;
  colorRangeInput.disabled = disabled;
  detailedLoggingInput.disabled = disabled;
  diagnosticStageInput.disabled = disabled;
  saveButton.disabled = disabled;
}

function getFormSettings() {
  const anime4kSettings = getAnime4kStorageValues(anime4kModeInput.value, preservedProfile);
  return {
    ...anime4kSettings,
    colorRangeMode: colorRangeInput.value,
    detailedLogging: detailedLoggingInput.checked,
    diagnosticStage: detailedLoggingInput.checked ? diagnosticStageInput.value : "full"
  };
}

async function saveSettings() {
  setFormDisabled(true);
  try {
    await chrome.storage.local.set(getFormSettings());
    status.style.color = "green";
    status.textContent = "設定を保存しました";
  } finally {
    setFormDisabled(false);
  }
}

anime4kModeInput.addEventListener("change", () => {
  if (anime4kModeInput.value !== ANIME4K_OFF_VALUE) {
    preservedProfile = anime4kModeInput.value;
  }
  modeNote.textContent = MODE_NOTES[anime4kModeInput.value];
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
