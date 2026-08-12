const enabledInput = document.querySelector("#enabled");
const profileInput = document.querySelector("#profile");
const detailedLoggingInput = document.querySelector("#detailed-logging");
const status = document.querySelector("#status");
const modeNote = document.querySelector("#mode-note");

const MODE_NOTES = {
  auto: "自動では安定性を優先し、Mode Aを使用します。",
  "mode-a": "一般的な720p・1080pアニメ向けの復元・アップスケールです。",
  "v4.1-low-resolution": "実験的な360p以下専用モードです。非常に高いGPU性能とVRAMを必要とします。"
};

async function initialize() {
  const settings = await chrome.storage.local.get({
    enabled: true,
    profile: "auto",
    detailedLogging: false
  });
  enabledInput.checked = settings.enabled;
  profileInput.value = settings.profile;
  detailedLoggingInput.checked = settings.detailedLogging;
  modeNote.textContent = MODE_NOTES[settings.profile];
}

async function saveAndReload(changes, message) {
  enabledInput.disabled = true;
  profileInput.disabled = true;
  detailedLoggingInput.disabled = true;
  await chrome.storage.local.set(changes);
  status.textContent = message;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id && tab.url?.startsWith("https://www.youtube.com/")) {
    await chrome.tabs.reload(tab.id);
  }

  enabledInput.disabled = false;
  profileInput.disabled = false;
  detailedLoggingInput.disabled = false;
}

enabledInput.addEventListener("change", async () => {
  await saveAndReload(
    { enabled: enabledInput.checked },
    enabledInput.checked ? "Anime4Kを有効にしました" : "Anime4Kを無効にしました"
  );
});

profileInput.addEventListener("change", async () => {
  modeNote.textContent = MODE_NOTES[profileInput.value];
  await saveAndReload({ profile: profileInput.value }, "処理モードを変更しました");
});

detailedLoggingInput.addEventListener("change", async () => {
  await saveAndReload(
    { detailedLogging: detailedLoggingInput.checked },
    detailedLoggingInput.checked ? "詳細ログを有効にしました" : "詳細ログを無効にしました"
  );
});

initialize().catch((error) => {
  status.textContent = `設定を読み込めませんでした: ${error.message}`;
});
