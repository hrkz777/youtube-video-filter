import {
  ANIME4K_OFF_VALUE,
  getAnime4kSelection,
  getAnime4kStorageValues
} from "./anime4k-setting.js";
import {
  DEFAULT_SETTINGS,
  VIDEO_ADJUSTMENT_DEFINITIONS,
  normalizeSettings
} from "./settings-schema.js";

const anime4kModeInput = document.querySelector("#anime4k-mode");
const colorRangeInput = document.querySelector("#color-range-mode");
const brightnessInput = document.querySelector("#brightness");
const brightnessValue = document.querySelector("#brightness-value");
const contrastInput = document.querySelector("#contrast");
const contrastValue = document.querySelector("#contrast-value");
const detailedLoggingInput = document.querySelector("#detailed-logging");
const diagnosticContainer = document.querySelector("#diagnostic-container");
const diagnosticStageInput = document.querySelector("#diagnostic-stage");
const saveButton = document.querySelector("#save-button");
const status = document.querySelector("#status");
const modeNote = document.querySelector("#mode-note");

const MODE_NOTES = {
  off: "Anime4Kは適用しません。カラーレンジ変換と映像調整は個別に使用できます。",
  auto: "自動では安定性を優先し、Mode Aを使用します。",
  "mode-a": "一般的な720p・1080pアニメ向けの復元・アップスケールです。",
  "mode-b": "比較的劣化の少ない720p・1080pアニメ向けです。",
  "mode-c": "低劣化素材向けで、ノイズを抑えながら拡大します。",
  "mode-aa": "Mode Aの二段構成です。2倍以上の拡大向けでGPU負荷が高くなります。",
  "mode-bb": "Mode Bの二段構成です。2倍以上の拡大向けでGPU負荷が高くなります。",
  "mode-ca": "Mode Cの後にMode A相当の復元・アップスケールを適用します。GPU負荷が高くなります。",
  "v4.1-low-resolution": "実験的な360p以下専用モードです。非常に高いGPU性能とVRAMを必要とします。"
};
let preservedProfile = DEFAULT_SETTINGS.profile;

function formatAdjustmentValue(value) {
  return `${value > 0 ? "+" : ""}${value}%`;
}

function configureAdjustmentInput(input, output, setting) {
  const definition = VIDEO_ADJUSTMENT_DEFINITIONS[setting];
  input.min = String(definition.minimum);
  input.max = String(definition.maximum);
  input.step = String(definition.step);
  input.addEventListener("input", () => {
    output.textContent = formatAdjustmentValue(Number(input.value));
  });
}

configureAdjustmentInput(brightnessInput, brightnessValue, "brightness");
configureAdjustmentInput(contrastInput, contrastValue, "contrast");

function setFormValues(settings) {
  settings = normalizeSettings(settings);
  preservedProfile = settings.profile;
  anime4kModeInput.value = getAnime4kSelection(settings);
  colorRangeInput.value = settings.colorRangeMode;
  brightnessInput.value = String(settings.brightness);
  brightnessValue.textContent = formatAdjustmentValue(settings.brightness);
  contrastInput.value = String(settings.contrast);
  contrastValue.textContent = formatAdjustmentValue(settings.contrast);
  detailedLoggingInput.checked = settings.detailedLogging;
  diagnosticStageInput.value = settings.diagnosticStage;
  diagnosticContainer.hidden = !settings.detailedLogging;
  modeNote.textContent = MODE_NOTES[anime4kModeInput.value];
}

async function initialize() {
  setFormValues(await chrome.storage.local.get(DEFAULT_SETTINGS));
}

function setFormDisabled(disabled) {
  anime4kModeInput.disabled = disabled;
  colorRangeInput.disabled = disabled;
  brightnessInput.disabled = disabled;
  contrastInput.disabled = disabled;
  detailedLoggingInput.disabled = disabled;
  diagnosticStageInput.disabled = disabled;
  saveButton.disabled = disabled;
}

function getFormSettings() {
  const anime4kSettings = getAnime4kStorageValues(anime4kModeInput.value, preservedProfile);
  return {
    ...anime4kSettings,
    colorRangeMode: colorRangeInput.value,
    brightness: Number(brightnessInput.value),
    contrast: Number(contrastInput.value),
    detailedLogging: detailedLoggingInput.checked,
    diagnosticStage: detailedLoggingInput.checked ? diagnosticStageInput.value : "full"
  };
}

async function saveSettings() {
  setFormDisabled(true);
  try {
    await chrome.storage.local.set(normalizeSettings(getFormSettings()));
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
