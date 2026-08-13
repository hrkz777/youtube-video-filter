import { persistOptimisticSetting } from "./optimistic-setting.js";
import {
  ANIME4K_OFF_VALUE,
  getAnime4kChanges,
  getAnime4kSelection,
  isAnime4kOverridden
} from "./anime4k-setting.js";

const BUTTON_CLASS = "ytp-youtube-filter-button";
const PANEL_CLASS = "ytp-youtube-filter-settings";
const OPEN_CLASS = "ytp-youtube-filter-settings-open";
const STYLE_ID = "youtube-video-filter-player-settings-style";
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const ANIME4K_MODES = [
  [ANIME4K_OFF_VALUE, "オフ"],
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
  anime4k: { title: "Anime4K", options: ANIME4K_MODES },
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
  .${PANEL_CLASS}.${PANEL_CLASS}__selection-page.ytp-popup.ytp-settings-menu {
    width: min(251px, calc(100% - 24px));
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
  .${PANEL_CLASS} .${PANEL_CLASS}__session-badge {
    display: inline-block;
    margin-left: 8px;
    padding: 1px 5px;
    border: 1px solid rgba(255, 255, 255, .55);
    border-radius: 3px;
    color: #fff;
    font-size: 10px;
    font-weight: 500;
    line-height: 14px;
    vertical-align: 1px;
  }
  .${PANEL_CLASS} .${PANEL_CLASS}__reset[aria-disabled="true"] {
    cursor: default;
    opacity: .5;
  }
  .${PANEL_CLASS} .${PANEL_CLASS}__save-error {
    color: #ffb4ab;
    cursor: default;
    pointer-events: none;
  }
  .${PANEL_CLASS} .${PANEL_CLASS}__save-error .ytp-menuitem-label {
    padding-left: 16px;
  }
  .${PANEL_CLASS} .${PANEL_CLASS}__statistic {
    cursor: default;
    pointer-events: none;
  }
  .${PANEL_CLASS} .${PANEL_CLASS}__statistic .ytp-menuitem-label {
    padding-left: 16px;
  }
  .${PANEL_CLASS} .${PANEL_CLASS}__statistic .ytp-menuitem-content {
    max-width: 58%;
    overflow: hidden;
    text-align: right;
    text-overflow: ellipsis;
    white-space: nowrap;
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
  element.addEventListener("click", (event) => {
    event.stopPropagation();
    activate();
  });
  element.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
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

function createSessionBadge() {
  const badge = document.createElement("span");
  badge.className = `${PANEL_CLASS}__session-badge`;
  badge.textContent = "タブ";
  badge.hidden = true;
  badge.setAttribute("aria-hidden", "true");
  return badge;
}

function createSubmenuItem(setting, title, iconPath, showSubmenu) {
  const item = document.createElement("div");
  item.className = "ytp-menuitem";
  item.dataset.submenuItem = setting;
  item.dataset.settingTitle = title;
  item.setAttribute("role", "menuitem");
  item.setAttribute("aria-haspopup", "true");
  item.tabIndex = 0;
  const content = document.createElement("div");
  content.className = "ytp-menuitem-content";
  content.dataset.valueFor = setting;
  const label = createMenuLabel(title);
  label.append(createSessionBadge());
  item.append(createMenuIcon(iconPath), label, content);
  makeInteractive(item, () => showSubmenu(setting));
  return item;
}

function createResetItem(resetSettings, showError) {
  const item = document.createElement("div");
  item.className = `ytp-menuitem ${PANEL_CLASS}__reset`;
  item.setAttribute("role", "menuitem");
  item.setAttribute("aria-label", "デフォルトへ戻す");
  item.setAttribute("aria-disabled", "true");
  item.tabIndex = 0;
  item.append(
    createMenuIcon("M12 5V2L7 7l5 5V9c3.31 0 6 2.69 6 6s-2.69 6-6 6a6 6 0 0 1-5.65-4H4.26A8 8 0 1 0 12 5Z"),
    createMenuLabel("デフォルトへ戻す"),
    Object.assign(document.createElement("div"), { className: "ytp-menuitem-content" })
  );
  makeInteractive(item, () => {
    if (item.getAttribute("aria-disabled") === "true") return;
    item.setAttribute("aria-disabled", "true");
    Promise.resolve(resetSettings()).catch((error) => {
      item.setAttribute("aria-disabled", "false");
      showError("デフォルト設定へ戻せませんでした");
      console.error("[YouTube Video Filter] デフォルト設定へ戻せませんでした", error);
    });
  });
  return item;
}

function createPanelHeader(title, showMain) {
  const header = document.createElement("div");
  header.className = "ytp-panel-header";
  const backContainer = document.createElement("div");
  backContainer.className = "ytp-panel-back-button-container";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "ytp-button ytp-panel-back-button";
  back.setAttribute("aria-label", "前のメニューに戻る");
  makeInteractive(back, showMain);
  backContainer.append(back);
  const heading = document.createElement("span");
  heading.className = "ytp-panel-title";
  heading.setAttribute("role", "heading");
  heading.setAttribute("aria-level", "2");
  heading.textContent = title;
  header.append(backContainer, heading);
  return header;
}

function createStatisticItem(key, title) {
  const item = document.createElement("div");
  item.className = `ytp-menuitem ${PANEL_CLASS}__statistic`;
  item.setAttribute("role", "presentation");
  const content = document.createElement("div");
  content.className = "ytp-menuitem-content";
  content.dataset.statisticValue = key;
  content.textContent = "—";
  item.append(createMenuLabel(title), content);
  return item;
}

function createPanel(onChange, onReset, getSettings, getOverriddenKeys) {
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
  let errorTimeoutId;
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
    const itemHeight = Object.hasOwn(SUBMENUS, currentPage) ? 40 : 48;
    const menuHeight = measuredMenuHeight > 0 ? measuredMenuHeight : visibleItemCount * itemHeight;
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
    root.classList.toggle(`${PANEL_CLASS}__selection-page`, Object.hasOwn(SUBMENUS, name));
    for (const [pageName, page] of pages) page.hidden = pageName !== name;
    updateLayout();
    requestAnimationFrame(() => {
      updateLayout();
      if (focus) focusableItems().at(0)?.focus({ preventScroll: true });
    });
  };
  const saveChange = (changes) => {
    void persistOptimisticSetting({
      persist: onChange,
      changes,
      onFailure: (error) => {
        root.syncSettings(getSettings(), getOverriddenKeys());
        root.showError("設定を保存できませんでした");
        console.error("[YouTube Video Filter] プレイヤー内設定を保存できませんでした", error);
      }
    });
  };

  const mainPanel = document.createElement("div");
  mainPanel.className = "ytp-panel";
  const mainMenu = document.createElement("div");
  mainMenu.className = "ytp-panel-menu";
  mainMenu.setAttribute("role", "menu");
  const anime4kItem = createSubmenuItem(
    "anime4k",
    "Anime4K",
    "M4 5h10v2H6v10h12v-5h2v7H4V5Zm14-3 .8 2.2L21 5l-2.2.8L18 8l-.8-2.2L15 5l2.2-.8L18 2Z",
    showPage
  );
  const colorItem = createSubmenuItem("colorRangeMode", "カラーレンジ", "M12 3a9 9 0 1 0 0 18V3Zm0 2v14a7 7 0 0 1 0-14Z", showPage);
  const resetItem = createResetItem(onReset, (message) => {
    root.syncSettings(getSettings(), getOverriddenKeys());
    root.showError(message);
  });
  mainMenu.append(anime4kItem, colorItem, resetItem);
  const saveErrorItem = document.createElement("div");
  saveErrorItem.className = `ytp-menuitem ${PANEL_CLASS}__save-error`;
  saveErrorItem.setAttribute("role", "alert");
  saveErrorItem.setAttribute("aria-live", "assertive");
  saveErrorItem.hidden = true;
  saveErrorItem.append(createMenuLabel("設定を保存できませんでした"));
  mainMenu.append(saveErrorItem);
  const statisticsItem = createSubmenuItem(
    "statistics",
    "統計情報",
    "M4 19h16v2H4v-2Zm1-2V9h3v8H5Zm5 0V3h3v14h-3Zm5 0v-6h3v6h-3Z",
    showPage
  );
  mainMenu.append(statisticsItem);
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
      option.append(createMenuLabel(label));
      makeInteractive(option, () => {
        root.setSetting(setting, value);
        saveChange(setting === "anime4k"
          ? getAnime4kChanges(value)
          : { [setting]: value });
        showPage("main");
      });
      menu.append(option);
    }
    panel.append(menu);
    pages.set(setting, panel);
    popupContent.append(panel);
  }

  const statisticsPanel = document.createElement("div");
  statisticsPanel.className = "ytp-panel";
  statisticsPanel.hidden = true;
  statisticsPanel.append(createPanelHeader("統計情報", () => showPage("main")));
  const statisticsMenu = document.createElement("div");
  statisticsMenu.className = "ytp-panel-menu";
  statisticsMenu.setAttribute("role", "group");
  statisticsMenu.setAttribute("aria-label", "現在の動画の統計情報");
  statisticsMenu.append(
    createStatisticItem("status", "状態"),
    createStatisticItem("resolution", "解像度"),
    createStatisticItem("inputFps", "入力FPS"),
    createStatisticItem("outputFps", "出力FPS"),
    createStatisticItem("dropRate", "破棄率")
  );
  statisticsPanel.append(statisticsMenu);
  pages.set("statistics", statisticsPanel);
  popupContent.append(statisticsPanel);

  root.setSetting = (setting, value) => {
    const descriptor = SUBMENUS[setting];
    const currentLabel = descriptor?.options.find(([optionValue]) => optionValue === value)?.[1] ?? "未設定";
    const valueElement = root.querySelector(`[data-value-for="${setting}"]`);
    if (valueElement) valueElement.textContent = currentLabel;
    for (const option of root.querySelectorAll(`[data-option-setting="${setting}"]`)) {
      option.setAttribute("aria-checked", String(option.dataset.optionValue === value));
    }
  };
  root.syncSettings = (settings, overriddenKeys = []) => {
    root.setSetting("anime4k", getAnime4kSelection(settings));
    root.setSetting("colorRangeMode", settings.colorRangeMode);
    const overridden = new Set(overriddenKeys);
    for (const item of root.querySelectorAll("[data-setting-title]")) {
      const setting = item.dataset.submenuItem;
      const isOverridden = setting === "anime4k"
        ? isAnime4kOverridden(overriddenKeys)
        : overridden.has(setting);
      const badge = item.querySelector(`.${PANEL_CLASS}__session-badge`);
      if (badge) badge.hidden = !isOverridden;
      item.setAttribute("aria-label", isOverridden
        ? `${item.dataset.settingTitle}（このタブ用設定）`
        : item.dataset.settingTitle);
    }
    resetItem.setAttribute("aria-disabled", String(overridden.size === 0));
    updateLayout();
  };
  root.syncStatistics = (statistics) => {
    const values = {
      status: statistics.status,
      resolution: statistics.inputWidth && statistics.inputHeight
        && statistics.outputWidth && statistics.outputHeight
        ? `${statistics.inputWidth}×${statistics.inputHeight} → ${statistics.outputWidth}×${statistics.outputHeight}`
        : "—",
      inputFps: Number.isFinite(statistics.inputFps) ? `${statistics.inputFps.toFixed(1)} fps` : "—",
      outputFps: Number.isFinite(statistics.outputFps) ? `${statistics.outputFps.toFixed(1)} fps` : "—",
      dropRate: Number.isFinite(statistics.dropRate) ? `${statistics.dropRate.toFixed(1)}%` : "—"
    };
    for (const [key, value] of Object.entries(values)) {
      const element = root.querySelector(`[data-statistic-value="${key}"]`);
      if (element) element.textContent = value || "—";
    }
  };
  root.showError = (message) => {
    clearTimeout(errorTimeoutId);
    saveErrorItem.querySelector(".ytp-menuitem-label").textContent = message;
    saveErrorItem.hidden = false;
    showPage("main", false);
    errorTimeoutId = setTimeout(() => {
      saveErrorItem.hidden = true;
      updateLayout();
    }, 3000);
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

export function createPlayerSettingsUi({ getSettings, getOverriddenKeys, getStatistics, onChange, onReset }) {
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
    panel.syncSettings(settings, getOverriddenKeys());
    panel.syncStatistics(getStatistics());
  };
  const syncStatistics = () => {
    if (!panel) return;
    panel.syncStatistics(getStatistics());
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
    panel = createPanel(onChange, onReset, getSettings, getOverriddenKeys);
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
  return { ensure, sync, syncStatistics, close };
}
