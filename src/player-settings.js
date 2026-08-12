const BUTTON_CLASS = "ytp-youtube-filter-button";
const PANEL_CLASS = "ytp-youtube-filter-settings";
const STYLE_ID = "youtube-filter-player-settings-style";

const PROFILES = [
  ["auto", "自動（推奨）"],
  ["mode-a", "v4.x Mode A"],
  ["mode-b", "v4.x Mode B"],
  ["mode-c", "v4.x Mode C"],
  ["mode-aa", "v4.x Mode A+A"],
  ["mode-bb", "v4.x Mode B+B"],
  ["mode-ac", "v4.x Mode A+C"],
  ["v4.1-low-resolution", "v4.1 Low resolution"]
];

const DIAGNOSTIC_STAGES = [
  ["full", "D: 通常の全処理"],
  ["source", "A: 入力映像のみ"],
  ["clamp", "B: ClampHighlightsまで"],
  ["restore", "C: Restore CNN VLまで"]
];

const COLOR_RANGE_MODES = [
  ["none", "変換なし"],
  ["limited-to-full", "リミテッド → フル"],
  ["full-to-limited", "フル → リミテッド"]
];

const PLAYER_SETTINGS_CSS = `
  .${BUTTON_CLASS} {
    position: relative;
    color: #ddd;
  }
  .${BUTTON_CLASS}:hover,
  .${BUTTON_CLASS}[aria-expanded="true"] {
    color: #fff;
  }
  .${BUTTON_CLASS}.is-enabled::after {
    position: absolute;
    right: 7px;
    bottom: 7px;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #f00;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, .65);
    content: "";
  }
  .${BUTTON_CLASS} svg {
    width: 100%;
    height: 100%;
    padding: 12px;
    box-sizing: border-box;
    fill: currentColor;
  }
  .${PANEL_CLASS} {
    position: absolute;
    right: 12px;
    bottom: 54px;
    z-index: 75;
    width: min(340px, calc(100% - 24px));
    max-height: calc(100% - 72px);
    overflow: auto;
    border-radius: 12px;
    background: rgba(28, 28, 28, .98);
    box-shadow: 0 4px 24px rgba(0, 0, 0, .55);
    color: #fff;
    font-family: Roboto, Arial, sans-serif;
    font-size: 13px;
    line-height: 1.4;
    text-align: left;
  }
  .${PANEL_CLASS}[hidden] {
    display: none !important;
  }
  .${PANEL_CLASS} * {
    box-sizing: border-box;
  }
  .${PANEL_CLASS}__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 48px;
    padding: 10px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, .12);
    font-size: 14px;
    font-weight: 500;
  }
  .${PANEL_CLASS}__badge {
    color: #aaa;
    font-size: 11px;
    font-weight: 400;
  }
  .${PANEL_CLASS}__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    min-height: 48px;
    padding: 8px 16px;
  }
  .${PANEL_CLASS}__label {
    min-width: 0;
  }
  .${PANEL_CLASS}__label small {
    display: block;
    margin-top: 2px;
    color: #aaa;
    font-size: 11px;
  }
  .${PANEL_CLASS} select {
    width: 164px;
    min-width: 0;
    padding: 7px 28px 7px 9px;
    border: 1px solid rgba(255, 255, 255, .18);
    border-radius: 4px;
    outline: none;
    background: #3f3f3f;
    color: #fff;
    font: inherit;
  }
  .${PANEL_CLASS} select:focus-visible {
    border-color: #fff;
  }
  .${PANEL_CLASS}__switch {
    position: relative;
    flex: 0 0 auto;
    width: 36px;
    height: 20px;
  }
  .${PANEL_CLASS}__switch input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
  }
  .${PANEL_CLASS}__track {
    display: block;
    width: 36px;
    height: 14px;
    margin-top: 3px;
    border-radius: 7px;
    background: #717171;
    cursor: pointer;
  }
  .${PANEL_CLASS}__track::after {
    display: block;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #bdbdbd;
    box-shadow: 0 1px 3px rgba(0, 0, 0, .55);
    transform: translate(-2px, -3px);
    transition: transform 120ms ease, background 120ms ease;
    content: "";
  }
  .${PANEL_CLASS}__switch input:checked + .${PANEL_CLASS}__track {
    background: rgba(255, 0, 0, .55);
  }
  .${PANEL_CLASS}__switch input:checked + .${PANEL_CLASS}__track::after {
    background: #f00;
    transform: translate(18px, -3px);
  }
  .${PANEL_CLASS}__switch input:focus-visible + .${PANEL_CLASS}__track {
    outline: 2px solid #fff;
    outline-offset: 2px;
  }
  .${PANEL_CLASS}__warning {
    margin: 4px 12px 12px;
    padding: 8px 10px;
    border-radius: 6px;
    background: rgba(255, 183, 0, .13);
    color: #f5d77c;
    font-size: 11px;
  }
`;

function createOptions(options) {
  return options.map(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    return option;
  });
}

function createSwitch(name, title, description) {
  const row = document.createElement("label");
  row.className = `${PANEL_CLASS}__row`;
  const label = document.createElement("span");
  label.className = `${PANEL_CLASS}__label`;
  label.textContent = title;
  if (description) {
    const note = document.createElement("small");
    note.textContent = description;
    label.append(note);
  }
  const control = document.createElement("span");
  control.className = `${PANEL_CLASS}__switch`;
  const input = document.createElement("input");
  input.type = "checkbox";
  input.dataset.setting = name;
  input.setAttribute("role", "switch");
  const track = document.createElement("span");
  track.className = `${PANEL_CLASS}__track`;
  control.append(input, track);
  row.append(label, control);
  return row;
}

function createSelect(name, title, options) {
  const row = document.createElement("label");
  row.className = `${PANEL_CLASS}__row`;
  const label = document.createElement("span");
  label.className = `${PANEL_CLASS}__label`;
  label.textContent = title;
  const select = document.createElement("select");
  select.dataset.setting = name;
  select.append(...createOptions(options));
  row.append(label, select);
  return row;
}

function createPanel(onChange) {
  const panel = document.createElement("section");
  panel.className = PANEL_CLASS;
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "YouTube Video Filter設定");
  const header = document.createElement("header");
  header.className = `${PANEL_CLASS}__header`;
  header.append(document.createTextNode("YouTube Video Filter"));
  const badge = document.createElement("span");
  badge.className = `${PANEL_CLASS}__badge`;
  badge.textContent = "WebGPU";
  header.append(badge);
  const enabledRow = createSwitch("enabled", "Anime4K", "動画へリアルタイム適用");
  const profileRow = createSelect("profile", "処理モード", PROFILES);
  const colorRangeRow = createSelect("colorRangeMode", "カラーレンジ", COLOR_RANGE_MODES);
  const loggingRow = createSwitch("detailedLogging", "詳細ログ", "問題調査用（動作が重くなる場合があります）");
  const diagnosticRow = createSelect("diagnosticStage", "診断パス", DIAGNOSTIC_STAGES);
  diagnosticRow.dataset.diagnosticRow = "true";
  const warning = document.createElement("p");
  warning.className = `${PANEL_CLASS}__warning`;
  warning.textContent = "詳細ログではフレーム状態を継続監視するため、再生やブラウザの動作が重くなる可能性があります。";
  panel.append(header, enabledRow, profileRow, colorRangeRow, loggingRow, diagnosticRow, warning);
  panel.addEventListener("change", (event) => {
    const input = event.target.closest("[data-setting]");
    if (!input) return;
    const value = input.type === "checkbox" ? input.checked : input.value;
    const changes = { [input.dataset.setting]: value };
    if (input.dataset.setting === "detailedLogging" && !value) changes.diagnosticStage = "full";
    Promise.resolve(onChange(changes)).catch((error) => {
      console.error("[YouTube Video Filter] プレイヤー内設定を保存できませんでした", error);
    });
  });
  panel.addEventListener("pointerdown", (event) => event.stopPropagation());
  return panel;
}

function createButton() {
  const button = document.createElement("button");
  button.className = `ytp-button ${BUTTON_CLASS}`;
  button.type = "button";
  button.title = "YouTube Video Filter設定";
  button.setAttribute("aria-label", "YouTube Video Filter設定");
  button.setAttribute("aria-haspopup", "dialog");
  button.setAttribute("aria-expanded", "false");
  const svgNamespace = "http://www.w3.org/2000/svg";
  const icon = document.createElementNS(svgNamespace, "svg");
  // パスの実座標範囲へ切り詰め、SVG自体が持つ空白を除去する。
  icon.setAttribute("viewBox", "4 2 17 17");
  icon.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(svgNamespace, "path");
  path.setAttribute("d", "M4 5h10v2H6v10h12v-5h2v7H4V5Zm14-3 .8 2.2L21 5l-2.2.8L18 8l-.8-2.2L15 5l2.2-.8L18 2Zm-5 6 1.1 2.9L17 12l-2.9 1.1L13 16l-1.1-2.9L9 12l2.9-1.1L13 8Z");
  icon.append(path);
  button.append(icon);
  return button;
}

export function createPlayerSettingsUi({ getSettings, onChange }) {
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = PLAYER_SETTINGS_CSS;
    document.documentElement.append(style);
  }
  let button = null;
  let panel = null;
  const close = () => {
    if (!panel || !button) return;
    panel.hidden = true;
    button.setAttribute("aria-expanded", "false");
  };
  const sync = () => {
    if (!panel || !button) return;
    const settings = getSettings();
    const filterEnabled = settings.enabled || settings.colorRangeMode !== "none";
    button.classList.toggle("is-enabled", filterEnabled);
    button.title = filterEnabled ? "YouTube Video Filter設定（有効）" : "YouTube Video Filter設定（無効）";
    for (const input of panel.querySelectorAll("[data-setting]")) {
      const value = settings[input.dataset.setting];
      if (input.type === "checkbox") input.checked = Boolean(value);
      else input.value = value;
    }
    panel.querySelector("[data-diagnostic-row]").hidden = !settings.detailedLogging;
  };
  const ensure = () => {
    const player = document.querySelector("#movie_player");
    const controls = player?.querySelector(".ytp-right-controls");
    if (!player || !controls) return;
    if (button?.isConnected && panel?.isConnected && panel.parentElement === player) return;
    button?.remove();
    panel?.remove();
    button = createButton();
    panel = createPanel(onChange);
    button.addEventListener("pointerdown", (event) => event.stopPropagation());
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const opening = panel.hidden;
      panel.hidden = !opening;
      button.setAttribute("aria-expanded", String(opening));
      if (opening) sync();
    });
    // 全画面など右端の主要操作を押しのけないよう、右側ボタン群の先頭へ置く。
    controls.insertBefore(button, controls.firstElementChild);
    player.append(panel);
    sync();
  };
  document.addEventListener("pointerdown", close);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
  return { ensure, sync, close };
}
