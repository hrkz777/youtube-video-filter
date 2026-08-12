const BUTTON_CLASS = "ytp-youtube-filter-button";
const PANEL_CLASS = "ytp-youtube-filter-settings";
const STYLE_ID = "youtube-filter-player-settings-style";
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

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

const COLOR_RANGE_MODES = [
  ["none", "変換なし"],
  ["limited-to-full", "リミテッド → フル"],
  ["full-to-limited", "フル → リミテッド"]
];

const DIAGNOSTIC_STAGES = [
  ["full", "D: 通常の全処理"],
  ["source", "A: 入力映像のみ"],
  ["clamp", "B: ClampHighlightsまで"],
  ["restore", "C: Restore CNN VLまで"]
];

const SUBMENUS = {
  profile: { title: "処理モード", options: PROFILES },
  colorRangeMode: { title: "カラーレンジ", options: COLOR_RANGE_MODES },
  diagnosticStage: { title: "診断パス", options: DIAGNOSTIC_STAGES }
};

const PLAYER_SETTINGS_CSS = `
  .${BUTTON_CLASS} {
    position: relative;
    color: #ddd;
  }
  @media (hover: hover) and (pointer: fine) {
    #movie_player .${BUTTON_CLASS} {
      opacity: 0;
      pointer-events: none;
      transition: opacity 100ms cubic-bezier(0.4, 0, 1, 1);
    }
    #movie_player:hover .${BUTTON_CLASS},
    #movie_player .${BUTTON_CLASS}:focus-visible,
    #movie_player .${BUTTON_CLASS}[aria-expanded="true"] {
      opacity: 1;
      pointer-events: auto;
      transition-timing-function: cubic-bezier(0, 0, 0.2, 1);
    }
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
    width: min(320px, calc(100% - 24px));
    max-height: calc(100% - 72px);
    overflow: hidden;
    border-radius: 12px;
    background: rgba(28, 28, 28, .98);
    box-shadow: 0 4px 24px rgba(0, 0, 0, .55);
    color: #fff;
    font-family: Roboto, Arial, sans-serif;
    font-size: 13px;
    line-height: 1.4;
    text-align: left;
  }
  .${PANEL_CLASS}[hidden],
  .${PANEL_CLASS}__page[hidden],
  .${PANEL_CLASS}__item[hidden] {
    display: none !important;
  }
  .${PANEL_CLASS} * {
    box-sizing: border-box;
  }
  .${PANEL_CLASS}__page {
    max-height: calc(100vh - 120px);
    overflow: auto;
    overscroll-behavior: contain;
  }
  .${PANEL_CLASS}__header {
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr) 40px;
    align-items: center;
    min-height: 48px;
    border-bottom: 1px solid rgba(255, 255, 255, .1);
  }
  .${PANEL_CLASS}__header--main {
    grid-template-columns: 1fr;
    padding: 0 16px;
  }
  .${PANEL_CLASS}__title {
    overflow: hidden;
    font-size: 14px;
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .${PANEL_CLASS}__back {
    display: grid;
    width: 40px;
    height: 40px;
    padding: 8px;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: #fff;
    cursor: pointer;
    place-items: center;
  }
  .${PANEL_CLASS}__back:hover,
  .${PANEL_CLASS}__back:focus-visible {
    background: rgba(255, 255, 255, .1);
    outline: none;
  }
  .${PANEL_CLASS}__back svg,
  .${PANEL_CLASS}__icon svg,
  .${PANEL_CLASS}__chevron svg,
  .${PANEL_CLASS}__check svg {
    width: 24px;
    height: 24px;
    fill: currentColor;
  }
  .${PANEL_CLASS}__menu {
    padding: 8px 0;
  }
  .${PANEL_CLASS}__item {
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr) auto;
    align-items: center;
    width: 100%;
    min-height: 48px;
    padding: 6px 12px;
    border: 0;
    outline: 0;
    background: transparent;
    color: #fff;
    font: inherit;
    text-align: left;
  }
  button.${PANEL_CLASS}__item,
  label.${PANEL_CLASS}__item {
    cursor: pointer;
  }
  .${PANEL_CLASS}__item:hover,
  .${PANEL_CLASS}__item:focus-within,
  button.${PANEL_CLASS}__item:focus-visible {
    background: rgba(255, 255, 255, .1);
  }
  .${PANEL_CLASS}__icon,
  .${PANEL_CLASS}__check {
    display: grid;
    color: #fff;
    place-items: center;
  }
  .${PANEL_CLASS}__label {
    min-width: 0;
    padding-right: 12px;
  }
  .${PANEL_CLASS}__label small {
    display: block;
    margin-top: 2px;
    color: #aaa;
    font-size: 11px;
    line-height: 1.35;
  }
  .${PANEL_CLASS}__value {
    display: flex;
    align-items: center;
    max-width: 150px;
    color: #ddd;
    gap: 4px;
  }
  .${PANEL_CLASS}__value-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .${PANEL_CLASS}__chevron {
    display: grid;
    flex: 0 0 auto;
    transform: scale(.75);
    place-items: center;
  }
  .${PANEL_CLASS}__switch {
    position: relative;
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
  .${PANEL_CLASS}__option {
    grid-template-columns: 40px minmax(0, 1fr);
  }
  .${PANEL_CLASS}__option[aria-checked="false"] .${PANEL_CLASS}__check {
    visibility: hidden;
  }
`;

function createSvg(pathData, viewBox = "0 0 24 24") {
  const icon = document.createElementNS(SVG_NAMESPACE, "svg");
  icon.setAttribute("viewBox", viewBox);
  icon.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVG_NAMESPACE, "path");
  path.setAttribute("d", pathData);
  icon.append(path);
  return icon;
}

function getOptionLabel(options, value) {
  return options.find(([optionValue]) => optionValue === value)?.[1] ?? "未設定";
}

function createHeader(title, onBack) {
  const header = document.createElement("header");
  header.className = `${PANEL_CLASS}__header${onBack ? "" : ` ${PANEL_CLASS}__header--main`}`;
  if (onBack) {
    const back = document.createElement("button");
    back.className = `${PANEL_CLASS}__back`;
    back.type = "button";
    back.title = "戻る";
    back.setAttribute("aria-label", "戻る");
    back.append(createSvg("M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12l6.6-6.6Z"));
    back.addEventListener("click", onBack);
    header.append(back);
  }
  const heading = document.createElement("div");
  heading.className = `${PANEL_CLASS}__title`;
  heading.textContent = title;
  header.append(heading);
  return header;
}

function createIconContainer(pathData) {
  const container = document.createElement("span");
  container.className = `${PANEL_CLASS}__icon`;
  container.append(createSvg(pathData));
  return container;
}

function createSwitchItem(name, title, description, iconPath, saveChange) {
  const row = document.createElement("label");
  row.className = `${PANEL_CLASS}__item`;
  row.append(createIconContainer(iconPath));
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
  input.addEventListener("change", () => {
    const changes = { [name]: input.checked };
    if (name === "detailedLogging" && !input.checked) changes.diagnosticStage = "full";
    saveChange(changes);
  });
  const track = document.createElement("span");
  track.className = `${PANEL_CLASS}__track`;
  control.append(input, track);
  row.append(label, control);
  return row;
}

function createSubmenuItem(setting, title, iconPath, showSubmenu) {
  const row = document.createElement("button");
  row.className = `${PANEL_CLASS}__item`;
  row.type = "button";
  row.dataset.submenuItem = setting;
  row.append(createIconContainer(iconPath));
  const label = document.createElement("span");
  label.className = `${PANEL_CLASS}__label`;
  label.textContent = title;
  const value = document.createElement("span");
  value.className = `${PANEL_CLASS}__value`;
  const valueText = document.createElement("span");
  valueText.className = `${PANEL_CLASS}__value-text`;
  valueText.dataset.valueFor = setting;
  const chevron = document.createElement("span");
  chevron.className = `${PANEL_CLASS}__chevron`;
  chevron.append(createSvg("m9 4 8 8-8 8-1.4-1.4 6.6-6.6-6.6-6.6L9 4Z"));
  value.append(valueText, chevron);
  row.append(label, value);
  row.addEventListener("click", () => showSubmenu(setting));
  return row;
}

function createPanel(onChange) {
  const panel = document.createElement("section");
  panel.className = PANEL_CLASS;
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "YouTube Video Filter設定");

  const pages = new Map();
  let currentPage = "main";
  const showPage = (name) => {
    currentPage = name;
    for (const [pageName, page] of pages) page.hidden = pageName !== name;
    pages.get(name)?.querySelector("button, input")?.focus({ preventScroll: true });
  };
  const saveChange = (changes) => {
    Promise.resolve(onChange(changes)).catch((error) => {
      console.error("[YouTube Video Filter] プレイヤー内設定を保存できませんでした", error);
    });
  };

  const mainPage = document.createElement("div");
  mainPage.className = `${PANEL_CLASS}__page`;
  mainPage.append(createHeader("YouTube Video Filter"));
  const mainMenu = document.createElement("div");
  mainMenu.className = `${PANEL_CLASS}__menu ytp-panel-menu`;
  const showSubmenu = (setting) => showPage(setting);
  const anime4kItem = createSwitchItem(
    "enabled",
    "Anime4K",
    "アップスケーリング",
    "M4 5h10v2H6v10h12v-5h2v7H4V5Zm14-3 .8 2.2L21 5l-2.2.8L18 8l-.8-2.2L15 5l2.2-.8L18 2Z",
    saveChange
  );
  const profileItem = createSubmenuItem("profile", "処理モード", "M3 17v2h6v-2H3Zm0-6v2h12v-2H3Zm0-6v2h18V5H3Z", showSubmenu);
  const colorItem = createSubmenuItem("colorRangeMode", "カラーレンジ", "M12 3a9 9 0 1 0 0 18V3Zm0 2v14a7 7 0 0 1 0-14Z", showSubmenu);
  const loggingItem = createSwitchItem(
    "detailedLogging",
    "詳細ログ",
    "有効にすると動作が重くなる可能性があります",
    "M11 17h2v-6h-2v6Zm0-8h2V7h-2v2Zm1-6a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 16a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z",
    saveChange
  );
  const diagnosticItem = createSubmenuItem("diagnosticStage", "診断パス", "M4 4h16v2H4V4Zm0 7h16v2H4v-2Zm0 7h10v2H4v-2Z", showSubmenu);
  diagnosticItem.dataset.diagnosticRow = "true";
  mainMenu.append(anime4kItem, profileItem, colorItem, loggingItem, diagnosticItem);
  mainPage.append(mainMenu);
  pages.set("main", mainPage);
  panel.append(mainPage);

  for (const [setting, descriptor] of Object.entries(SUBMENUS)) {
    const page = document.createElement("div");
    page.className = `${PANEL_CLASS}__page`;
    page.hidden = true;
    page.append(createHeader(descriptor.title, () => showPage("main")));
    const menu = document.createElement("div");
    menu.className = `${PANEL_CLASS}__menu ytp-panel-menu`;
    menu.setAttribute("role", "menu");
    for (const [value, label] of descriptor.options) {
      const option = document.createElement("button");
      option.className = `${PANEL_CLASS}__item ${PANEL_CLASS}__option`;
      option.type = "button";
      option.dataset.optionSetting = setting;
      option.dataset.optionValue = value;
      option.setAttribute("role", "menuitemradio");
      option.setAttribute("aria-checked", "false");
      const check = document.createElement("span");
      check.className = `${PANEL_CLASS}__check`;
      check.append(createSvg("m9.2 16.2-4.4-4.4L3.4 13.2 9.2 19 21 7.2l-1.4-1.4-10.4 10.4Z"));
      const text = document.createElement("span");
      text.className = `${PANEL_CLASS}__label`;
      text.textContent = label;
      option.append(check, text);
      option.addEventListener("click", () => {
        panel.setSetting(setting, value);
        saveChange({ [setting]: value });
        showPage("main");
      });
      menu.append(option);
    }
    page.append(menu);
    pages.set(setting, page);
    panel.append(page);
  }

  panel.setSetting = (setting, value) => {
    const descriptor = SUBMENUS[setting];
    if (descriptor) {
      const valueElement = panel.querySelector(`[data-value-for="${setting}"]`);
      if (valueElement) valueElement.textContent = getOptionLabel(descriptor.options, value);
      for (const option of panel.querySelectorAll(`[data-option-setting="${setting}"]`)) {
        option.setAttribute("aria-checked", String(option.dataset.optionValue === value));
      }
    }
  };
  panel.syncSettings = (settings) => {
    for (const input of panel.querySelectorAll("input[data-setting]")) {
      input.checked = Boolean(settings[input.dataset.setting]);
    }
    for (const setting of Object.keys(SUBMENUS)) panel.setSetting(setting, settings[setting]);
    diagnosticItem.hidden = !settings.detailedLogging;
  };
  panel.showMain = () => showPage("main");
  panel.isMainPage = () => currentPage === "main";
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
  // パスの実座標範囲へ切り詰め、SVG自体が持つ空白を除去する。
  button.append(createSvg("M4 5h10v2H6v10h12v-5h2v7H4V5Zm14-3 .8 2.2L21 5l-2.2.8L18 8l-.8-2.2L15 5l2.2-.8L18 2Zm-5 6 1.1 2.9L17 12l-2.9 1.1L13 16l-1.1-2.9L9 12l2.9-1.1L13 8Z", "4 2 17 17"));
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
    panel.showMain();
    button.setAttribute("aria-expanded", "false");
  };
  const sync = () => {
    if (!panel || !button) return;
    const settings = getSettings();
    const filterEnabled = settings.enabled || settings.colorRangeMode !== "none";
    button.classList.toggle("is-enabled", filterEnabled);
    button.title = filterEnabled ? "YouTube Video Filter設定（有効）" : "YouTube Video Filter設定（無効）";
    panel.syncSettings(settings);
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
      if (opening) {
        panel.showMain();
        sync();
      }
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
