const enabledInput = document.querySelector("#enabled");
const profileInput = document.querySelector("#profile");
const detailedLoggingInput = document.querySelector("#detailed-logging");
const diagnosticContainer = document.querySelector("#diagnostic-container");
const diagnosticStageInput = document.querySelector("#diagnostic-stage");
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

async function initialize() {
  const settings = await chrome.storage.local.get({
    enabled: true,
    profile: "auto",
    detailedLogging: false,
    diagnosticStage: "full"
  });
  enabledInput.checked = settings.enabled;
  profileInput.value = settings.profile;
  detailedLoggingInput.checked = settings.detailedLogging;
  diagnosticStageInput.value = DIAGNOSTIC_STAGES.has(settings.diagnosticStage)
    ? settings.diagnosticStage
    : "full";
  diagnosticContainer.hidden = !settings.detailedLogging;
  modeNote.textContent = MODE_NOTES[settings.profile];
}

async function saveSettings(changes, message) {
  enabledInput.disabled = true;
  profileInput.disabled = true;
  detailedLoggingInput.disabled = true;
  diagnosticStageInput.disabled = true;
  await chrome.storage.local.set(changes);
  status.textContent = message;

  enabledInput.disabled = false;
  profileInput.disabled = false;
  detailedLoggingInput.disabled = false;
  diagnosticStageInput.disabled = false;
}

enabledInput.addEventListener("change", async () => {
  await saveSettings(
    { enabled: enabledInput.checked },
    enabledInput.checked ? "Anime4Kを有効にしました" : "Anime4Kを無効にしました"
  );
});

profileInput.addEventListener("change", async () => {
  modeNote.textContent = MODE_NOTES[profileInput.value];
  await saveSettings({ profile: profileInput.value }, "処理モードを変更しました");
});

detailedLoggingInput.addEventListener("change", async () => {
  diagnosticContainer.hidden = !detailedLoggingInput.checked;
  await saveSettings(
    {
      detailedLogging: detailedLoggingInput.checked,
      diagnosticStage: detailedLoggingInput.checked ? diagnosticStageInput.value : "full"
    },
    detailedLoggingInput.checked ? "詳細ログを有効にしました" : "詳細ログを無効にしました"
  );
});

diagnosticStageInput.addEventListener("change", async () => {
  await saveSettings(
    { diagnosticStage: diagnosticStageInput.value },
    `診断パスを${diagnosticStageInput.selectedOptions[0].textContent}へ変更しました`
  );
});

initialize().catch((error) => {
  status.textContent = `設定を読み込めませんでした: ${error.message}`;
});
