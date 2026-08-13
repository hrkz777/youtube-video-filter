const BUTTON_CLASS = "ytp-youtube-filter-button";
const PANEL_CLASS = "ytp-youtube-filter-settings";
const OPEN_CLASS = "ytp-youtube-filter-settings-open";
const STYLE_ID = "youtube-video-filter-player-settings-style";
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

const SUBMENUS = {
  profile: { title: "処理モード", options: PROFILES },
  colorRangeMode: { title: "カラーレンジ", options: COLOR_RANGE_MODES }
};

const PLAYER_SETTINGS_CSS = `
  .${BUTTON_CLASS} {
    position: relative;
    color: #ddd;
  }
  #movie_player.${OPEN_CLASS} .ytp-chrome-bottom {
    visibility: visible !important;
    opacity: 1 !important;
    pointer-events: auto !important;
  }
  #movie_player.${OPEN_CLASS} .ytp-gradient-bottom {
    visibility: visible !important;
    opacity: 1 !important;
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
  .${PANEL_CLASS}.ytp-popup.ytp-settings-menu {
    right: 12px;
    bottom: 54px;
    z-index: 75;
    width: min(437px, calc(100% - 24px));
    height: auto;
    max-height: calc(100% - 72px);
  }
  .${PANEL_CLASS}.ytp-popup.ytp-settings-menu:not([hidden]) {
    display: block !important;
    visibility: visible;
    opacity: 1;
  }
  .${PANEL_CLASS}[hidden],
  .${PANEL_CLASS} .ytp-panel[hidden],
  .${PANEL_CLASS} .ytp-menuitem[hidden] {
    display: none !important;
  }
  .${PANEL_CLASS} .ytp-popup-content,
  .${PANEL_CLASS} .ytp-panel,
  .${PANEL_CLASS} .ytp-panel-menu {
    width: 100%;
    max-height: calc(100vh - 120px);
  }
  .${PANEL_CLASS} .ytp-popup-content {
    position: relative;
  }
  .${PANEL_CLASS} .ytp-panel-menu {
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .${PANEL_CLASS} .ytp-panel-back-button svg,
  .${PANEL_CLASS} .ytp-menuitem-icon svg {
    width: 24px;
    height: 24px;
    fill: currentColor;
  }
  .${PANEL_CLASS} .${PANEL_CLASS}__option[aria-checked="false"] .ytp-menuitem-icon {
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

function makeInteractive(element, activate) {
  element.addEventListener("click", activate);
  element.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    activate();
  });
}

function createMenuIcon(pathData) {
  const icon = document.createElement("div");
  icon.className = "ytp-menuitem-icon";
  icon.append(createSvg(pathData));
  return icon;
}

function createMenuLabel(title) {
  const label = document.createElement("div");
  label.className = "ytp-menuitem-label";
  label.textContent = title;
  return label;
}

function createToggleItem(setting, title, iconPath, saveChange) {
  const item = document.createElement("div");
  item.className = "ytp-menuitem";
  item.dataset.toggleSetting = setting;
  item.setAttribute("role", "menuitemcheckbox");
  item.setAttribute("aria-checked", "false");
  item.setAttribute("aria-label", title);
  item.tabIndex = 0;
  const content = document.createElement("div");
  content.className = "ytp-menuitem-content";
  const toggle = document.createElement("div");
  toggle.className = "ytp-menuitem-toggle-checkbox";
  content.append(toggle);
  item.append(createMenuIcon(iconPath), createMenuLabel(title), content);
  makeInteractive(item, () => {
    const checked = item.getAttribute("aria-checked") !== "true";
    item.setAttribute("aria-checked", String(checked));
    const changes = { [setting]: checked };
    saveChange(changes);
  });
  return item;
}

function createSubmenuItem(setting, title, iconPath, showSubmenu) {
  const item = document.createElement("div");
  item.className = "ytp-menuitem";
  item.dataset.submenuItem = setting;
  item.setAttribute("role", "menuitem");
  item.setAttribute("aria-haspopup", "true");
  item.tabIndex = 0;
  const content = document.createElement("div");
  content.className = "ytp-menuitem-content";
  content.dataset.valueFor = setting;
  item.append(createMenuIcon(iconPath), createMenuLabel(title), content);
  makeInteractive(item, () => showSubmenu(setting));
  return item;
}

function createPanelHeader(title, showMain) {
  const header = document.createElement("div");
  header.className = "ytp-panel-header";
  const back = document.createElement("div");
  back.className = "ytp-panel-back-button";
  back.setAttribute("role", "button");
  back.setAttribute("aria-label", "戻る");
  back.tabIndex = 0;
  makeInteractive(back, showMain);
  const heading = document.createElement("div");
  heading.className = "ytp-panel-title";
  heading.textContent = title;
  header.append(back, heading);
  return header;
}

function createPanel(onChange) {
  const root = document.createElement("div");
  root.className = `${PANEL_CLASS} ytp-popup ytp-settings-menu`;
  root.dataset.layer = "6";
  root.hidden = true;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", "YouTube Video Filter設定");

  const focusBefore = document.createElement("div");
  focusBefore.className = "ytp-focus-trap-before";
  focusBefore.tabIndex = 0;
  const popupContent = document.createElement("div");
  popupContent.className = "ytp-popup-content";
  const focusAfter = document.createElement("div");
  focusAfter.className = "ytp-focus-trap-after";
  focusAfter.tabIndex = 0;
  root.append(focusBefore, popupContent, focusAfter);

  const pages = new Map();
  let currentPage = "main";
  const updateLayout = () => {
    const activePanel = pages.get(currentPage);
    if (!activePanel || root.hidden) return;
    root.style.removeProperty("height");
    popupContent.style.removeProperty("height");
    activePanel.style.removeProperty("height");
    const header = activePanel.querySelector(".ytp-panel-header");
    const headerHeight = header ? Math.max(header.offsetHeight, 48) : 0;
    const menu = activePanel.querySelector(".ytp-panel-menu");
    menu?.style.removeProperty("height");
    const visibleItemCount = menu
      ? [...menu.children].filter((item) => !item.hidden).length
      : 0;
    const measuredMenuHeight = menu?.scrollHeight ?? 0;
    const menuHeight = measuredMenuHeight > 0 ? measuredMenuHeight : visibleItemCount * 48;
    const playerHeight = root.parentElement?.clientHeight || window.innerHeight;
    const maximumHeight = Math.max(48, playerHeight - 72);
    const height = Math.min(Math.max(48, headerHeight + menuHeight), maximumHeight);
    root.style.setProperty("height", `${height}px`, "important");
    popupContent.style.setProperty("height", `${height}px`, "important");
    activePanel.style.setProperty("height", `${height}px`, "important");
    if (menu) menu.style.setProperty("height", `${height - headerHeight}px`, "important");
  };
  const focusableItems = () => [...pages.get(currentPage).querySelectorAll('[tabindex="0"]')]
    .filter((element) => !element.hidden);
  focusBefore.addEventListener("focus", () => focusableItems().at(-1)?.focus());
  focusAfter.addEventListener("focus", () => focusableItems().at(0)?.focus());

  const showPage = (name, focus = true) => {
    currentPage = name;
    for (const [pageName, page] of pages) page.hidden = pageName !== name;
    updateLayout();
    requestAnimationFrame(() => {
      updateLayout();
      if (focus) focusableItems().at(0)?.focus({ preventScroll: true });
    });
  };
  const saveChange = (changes) => {
    Promise.resolve(onChange(changes)).catch((error) => {
      console.error("[YouTube Video Filter] プレイヤー内設定を保存できませんでした", error);
    });
  };

  const mainPanel = document.createElement("div");
  mainPanel.className = "ytp-panel";
  const mainMenu = document.createElement("div");
  mainMenu.className = "ytp-panel-menu";
  mainMenu.setAttribute("role", "menu");
  const anime4kItem = createToggleItem(
    "enabled",
    "Anime4K",
    "M4 5h10v2H6v10h12v-5h2v7H4V5Zm14-3 .8 2.2L21 5l-2.2.8L18 8l-.8-2.2L15 5l2.2-.8L18 2Z",
    saveChange
  );
  const profileItem = createSubmenuItem("profile", "処理モード", "M3 17v2h6v-2H3Zm0-6v2h12v-2H3Zm0-6v2h18V5H3Z", showPage);
  const colorItem = createSubmenuItem("colorRangeMode", "カラーレンジ", "M12 3a9 9 0 1 0 0 18V3Zm0 2v14a7 7 0 0 1 0-14Z", showPage);
  mainMenu.append(anime4kItem, profileItem, colorItem);
  mainPanel.append(mainMenu);
  pages.set("main", mainPanel);
  popupContent.append(mainPanel);

  for (const [setting, descriptor] of Object.entries(SUBMENUS)) {
    const panel = document.createElement("div");
    panel.className = "ytp-panel";
    panel.hidden = true;
    panel.append(createPanelHeader(descriptor.title, () => showPage("main")));
    const menu = document.createElement("div");
    menu.className = "ytp-panel-menu";
    menu.setAttribute("role", "menu");
    for (const [value, label] of descriptor.options) {
      const option = document.createElement("div");
      option.className = `ytp-menuitem ${PANEL_CLASS}__option`;
      option.dataset.optionSetting = setting;
      option.dataset.optionValue = value;
      option.setAttribute("role", "menuitemradio");
      option.setAttribute("aria-checked", "false");
      option.setAttribute("aria-label", label);
      option.tabIndex = 0;
      option.append(
        createMenuIcon("m9.2 16.2-4.4-4.4L3.4 13.2 9.2 19 21 7.2l-1.4-1.4-10.4 10.4Z"),
        createMenuLabel(label),
        Object.assign(document.createElement("div"), { className: "ytp-menuitem-content" })
      );
      makeInteractive(option, () => {
        root.setSetting(setting, value);
        saveChange({ [setting]: value });
        showPage("main");
      });
      menu.append(option);
    }
    panel.append(menu);
    pages.set(setting, panel);
    popupContent.append(panel);
  }

  root.setSetting = (setting, value) => {
    const descriptor = SUBMENUS[setting];
    const currentLabel = descriptor?.options.find(([optionValue]) => optionValue === value)?.[1] ?? "未設定";
    const valueElement = root.querySelector(`[data-value-for="${setting}"]`);
    if (valueElement) valueElement.textContent = currentLabel;
    for (const option of root.querySelectorAll(`[data-option-setting="${setting}"]`)) {
      option.setAttribute("aria-checked", String(option.dataset.optionValue === value));
    }
  };
  root.syncSettings = (settings) => {
    for (const item of root.querySelectorAll("[data-toggle-setting]")) {
      item.setAttribute("aria-checked", String(Boolean(settings[item.dataset.toggleSetting])));
    }
    for (const setting of Object.keys(SUBMENUS)) root.setSetting(setting, settings[setting]);
    updateLayout();
  };
  root.showMain = (focus = true) => showPage("main", focus);
  root.setOpen = (open) => {
    root.hidden = !open;
    root.setAttribute("aria-hidden", String(!open));
    root.style.setProperty("display", open ? "block" : "none", "important");
    root.style.setProperty("visibility", open ? "visible" : "hidden", "important");
    root.style.setProperty("opacity", open ? "1" : "0", "important");
    root.style.setProperty("pointer-events", open ? "auto" : "none", "important");
    if (open) {
      updateLayout();
      requestAnimationFrame(updateLayout);
    }
  };
  root.setOpen(false);
  root.addEventListener("pointerdown", (event) => event.stopPropagation());
  return root;
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
  let mountedPlayer = null;
  const close = () => {
    mountedPlayer?.classList.remove(OPEN_CLASS);
    if (!panel || !button) return;
    panel.setOpen(false);
    panel.showMain(false);
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
    mountedPlayer?.classList.remove(OPEN_CLASS);
    button?.remove();
    panel?.remove();
    mountedPlayer = player;
    button = createButton();
    panel = createPanel(onChange);
    button.addEventListener("pointerdown", (event) => event.stopPropagation());
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const opening = button.getAttribute("aria-expanded") !== "true";
      player.classList.toggle(OPEN_CLASS, opening);
      panel.setOpen(opening);
      button.setAttribute("aria-expanded", String(opening));
      if (opening) {
        sync();
        panel.showMain();
        requestAnimationFrame(() => {
          const bounds = panel.getBoundingClientRect();
          if (bounds.width === 0 || bounds.height === 0) {
            console.error("[YouTube Video Filter] 設定パネルの表示領域を確保できませんでした", {
              display: getComputedStyle(panel).display,
              visibility: getComputedStyle(panel).visibility,
              width: bounds.width,
              height: bounds.height
            });
          }
        });
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
