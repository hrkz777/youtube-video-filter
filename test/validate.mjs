import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";

const manifest = JSON.parse(await readFile("dist/manifest.json", "utf8"));
const rules = JSON.parse(await readFile("dist/rules.json", "utf8"));
const contentBundle = await readFile("dist/content.js", "utf8");
const popupDocument = await readFile("dist/popup.html", "utf8");
const popupStyles = await readFile("dist/popup.css", "utf8");
const popupBundle = await readFile("dist/popup.js", "utf8");
const backgroundBundle = await readFile("dist/background.js", "utf8");
const icon = await readFile("dist/design/icon.png");
const contentSource = await readFile("src/content.js", "utf8");
const filterFailureSource = await readFile("src/filter-failure.js", "utf8");
const rendererSource = await readFile("src/renderer.js", "utf8");
const playerSettingsSource = await readFile("src/player-settings.js", "utf8");

assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.name, "YouTube Video Filter");
assert.equal(manifest.version, "0.2.0");
assert.deepEqual(manifest.icons, {
  16: "design/icon.png",
  32: "design/icon.png",
  48: "design/icon.png",
  128: "design/icon.png"
});
assert.deepEqual(manifest.action.default_icon, {
  16: "design/icon.png",
  32: "design/icon.png"
});
assert.deepEqual(manifest.content_scripts[0].matches, ["https://www.youtube.com/*"]);
assert.deepEqual(manifest.host_permissions, [
  "https://www.youtube.com/*",
  "https://*.googlevideo.com/*"
]);
assert.equal(manifest.host_permissions.includes("<all_urls>"), false);
assert.equal(manifest.permissions.includes("activeTab"), false);
assert.equal(manifest.background.service_worker, "background.js");
assert.equal(rules[0].condition.urlFilter, "||googlevideo.com/");
assert.deepEqual(rules[0].condition.resourceTypes, ["media"]);

for (const pipelineName of [
  "GANUUL",
  "GANx4UUL",
  "CNNSoftM",
  "CNNx2M",
  "ModeA",
  "ModeB",
  "ModeC",
  "ModeAA",
  "ModeBB",
  "Original",
  "ClampHighlights",
  "CNNVL"
]) {
  assert.match(contentBundle, new RegExp(`\\b${pipelineName}\\b`));
}

assert.match(contentBundle, /detailedLogging/);
assert.match(contentBundle, /uncapturederror/);
assert.match(contentBundle, /device\.lost/);
assert.match(contentBundle, /onSubmittedWorkDone/);
assert.match(contentBundle, /YouTube video input \(rgba8unorm\)/);
assert.match(contentBundle, /copyExternalImageToTexture/);
assert.match(contentBundle, /GPUTextureUsage\.RENDER_ATTACHMENT/);
assert.match(contentBundle, /new OffscreenCanvas/);
assert.match(contentBundle, /bridgeContext\.drawImage/);
assert.match(contentBundle, /transferToImageBitmap/);
assert.match(contentBundle, /2d-canvas-to-image-bitmap/);
assert.match(contentBundle, /onInputSample/);
assert.match(contentBundle, /copyTextureToBuffer/);
assert.match(contentBundle, /onGpuInputSample/);
assert.match(contentBundle, /onGpuOutputSample/);
assert.match(contentBundle, /onFrameStats/);
assert.match(playerSettingsSource, /統計情報/);
assert.match(playerSettingsSource, /デフォルトへ戻す/);
assert.match(playerSettingsSource, /__session-badge/);
assert.match(playerSettingsSource, /このタブ用設定/);
assert.match(playerSettingsSource, /ytp-panel-back-button-container/);
assert.match(playerSettingsSource, /ytp-button ytp-panel-back-button/);
assert.match(playerSettingsSource, /前のメニューに戻る/);
assert.match(playerSettingsSource, /PANEL_CLASS}__selection-page/);
assert.match(playerSettingsSource, /入力FPS/);
assert.match(playerSettingsSource, /出力FPS/);
assert.match(playerSettingsSource, /破棄率/);
assert.match(contentBundle, /data-statistic-value/);
assert.match(contentBundle, /syncStatistics/);
assert.match(contentSource, /getStatistics:\s*\(\) => currentStatistics/);
assert.doesNotMatch(contentSource, /onFrameStats:\s*detailedLogging/);
assert.match(contentBundle, /frameInFlight/);
assert.match(contentBundle, /MAX_INPUT_FRAME_DRIFT_SECONDS/);
assert.match(contentBundle, /synchronizationOffsetMs/);
assert.match(contentBundle, /visibility\s*=\s*["']hidden["']/);
assert.match(contentBundle, /elementsFromPoint/);
assert.match(contentBundle, /ResizeObserver/);
assert.match(contentBundle, /videoBounds\.height/);
assert.match(contentSource, /FILTER_RESIZE_DEBOUNCE_MILLISECONDS\s*=\s*300/);
assert.match(contentSource, /function createCanvas\(video, onTargetSizeChange\)/);
assert.match(contentSource, /onTargetSizeChange\?\.\(targetSize\)/);
assert.match(contentSource, /scheduleResizeRestart\(latestTargetSize \?\? getCanvasSize\(video\)\)/);
assert.match(contentSource, /表示サイズの変更に合わせてフィルターを再初期化/);
assert.match(contentSource, /previousOutputSize/);
assert.match(contentSource, /nextOutputSize/);
assert.match(contentBundle, /chrome\.storage\.onChanged/);
assert.match(contentSource, /let tabSettings = \{\}/);
assert.match(contentSource, /let overriddenSettingKeys = \[\]/);
assert.match(contentSource, /chrome\.runtime\.sendMessage/);
assert.match(contentSource, /restoreOriginalVideo\(compatibilityError\)/);
assert.match(filterFailureSource, /createFilterFailureRegistry/);
assert.match(filterFailureSource, /getFilterCompatibilityError/);
assert.match(backgroundBundle, /youtube-video-filter:get-tab-settings/);
assert.match(backgroundBundle, /youtube-video-filter:set-tab-settings/);
assert.match(backgroundBundle, /youtube-video-filter:reset-tab-settings/);
assert.match(backgroundBundle, /overriddenKeys/);
assert.match(backgroundBundle, /normalizeSessionRecord/);
assert.match(backgroundBundle, /chrome\.storage\.session/);
assert.match(backgroundBundle, /chrome\.storage\.local\.get\(SESSION_SETTINGS_DEFAULTS\)/);
assert.match(backgroundBundle, /chrome\.tabs\.onRemoved/);
assert.doesNotMatch(backgroundBundle, /message\.tabId/);
assert.doesNotMatch(backgroundBundle, /chrome\.tabs\.sendMessage/);
assert.match(contentBundle, /cancelActiveProcessing/);
assert.match(contentBundle, /activeVideoSource/);
assert.match(contentBundle, /video\.currentSrc !== activeVideoSource/);
assert.match(contentBundle, /addEventListener\(["']loadstart["']/);
assert.match(contentBundle, /addEventListener\(["']emptied["']/);
assert.match(contentBundle, /yt-navigate-start/);
assert.match(contentBundle, /document\.visibilityState !== ["']visible["']/);
assert.match(contentBundle, /addEventListener\(["']visibilitychange["']/);
assert.match(contentSource, /タブが非表示になったためフィルター処理を停止/);
assert.match(contentBundle, /ytp-youtube-filter-button/);
assert.match(contentBundle, /ytp-right-controls/);
assert.match(contentBundle, /controls\.firstElementChild/);
assert.match(contentBundle, /ytp-youtube-filter-settings-open/);
assert.match(contentBundle, /ytp-gradient-bottom/);
assert.match(contentBundle, /classList\.toggle\([^\n]+opening/);
assert.match(contentBundle, /4 2 17 17/);
assert.match(contentBundle, /aria-haspopup/);
assert.match(
  rendererSource,
  /const drawFrame = \(now, metadata\) => \{[\s\S]*?requestVideoFrameCallback\(drawFrame\);[\s\S]*?if \(frameInFlight\)/
);
assert.match(
  rendererSource,
  /if \(frameInFlight\) \{[\s\S]*?droppedFrames \+= 1;[\s\S]*?return;/
);
assert.equal(rendererSource.match(/device\.queue\.onSubmittedWorkDone\(\)/g)?.length, 1);
assert.match(rendererSource, /FRAME_STATS_INTERVAL_MILLISECONDS\s*=\s*1000/);
assert.match(rendererSource, /approximateInputFps/);
assert.match(rendererSource, /intervalDropRate/);
assert.match(rendererSource, /intervalDroppedFrames/);
assert.match(rendererSource, /intervalStaleFrames/);
assert.match(playerSettingsSource, /createStatisticItem\("status", "状態"\)/);
assert.match(playerSettingsSource, /createStatisticItem\("resolution", "解像度"\)/);
assert.match(playerSettingsSource, /statisticsMenu\.setAttribute\("role", "group"\)/);
assert.doesNotMatch(playerSettingsSource, /chrome\.storage/);
assert.match(contentBundle, /aria-expanded/);
assert.match(contentBundle, /menuitemradio/);
assert.match(contentBundle, /optionSetting/);
assert.match(contentBundle, /ytp-panel-menu/);
assert.match(contentBundle, /ytp-popup ytp-settings-menu/);
assert.match(contentBundle, /ytp-settings-menu:not\(\[hidden\]\)/);
assert.match(contentBundle, /display:\s*block\s*!important/);
assert.match(contentBundle, /style\.setProperty\([^\n]+important/);
assert.match(contentBundle, /bounds\.width === 0 \|\| bounds\.height === 0/);
assert.match(contentBundle, /scrollHeight/);
assert.match(contentBundle, /Object\.hasOwn\(SUBMENUS, currentPage\) \? 40 : 48/);
assert.match(contentBundle, /visibleItemCount \* itemHeight/);
assert.match(contentBundle, /removeProperty\(["']height["']\)/);
assert.match(contentBundle, /headerHeight \+ menuHeight/);
assert.match(contentBundle, /activePanel\.style\.setProperty\([^\n]+height/);
assert.match(contentBundle, /ytp-popup-content/);
assert.match(contentBundle, /ytp-menuitem-toggle-checkbox/);
assert.doesNotMatch(contentBundle, /\\u8A73\\u7D30\\u30ED\\u30B0\\uFF08\\u52D5\\u4F5C/);
assert.match(contentBundle, /ytp-focus-trap-before/);
assert.match(contentBundle, /ytp-focus-trap-after/);
assert.match(contentBundle, /limited-to-full/);
assert.match(contentBundle, /full-to-limited/);
assert.match(contentBundle, /255\.0\s*\/\s*219\.0/);
assert.match(contentBundle, /219\.0\s*\/\s*255\.0/);
assert.match(popupDocument, /id="color-range-mode"/);
assert.match(popupDocument, /リミテッド → フル/);
assert.match(popupDocument, /フル → リミテッド/);
assert.match(popupDocument, /id="detailed-logging"/);
assert.match(popupDocument, /動作が重くなる可能性があります/);
assert.match(popupDocument, /id="diagnostic-stage"/);
assert.match(popupDocument, /class="checkbox-group"/);
assert.match(popupDocument, /id="save-button"/);
assert.doesNotMatch(popupDocument, /id="settings-scope"/);
assert.doesNotMatch(popupDocument, /id="reset-tab-button"/);
assert.match(popupDocument, />保存<\/button>/);
assert.match(popupDocument, /A: 入力映像のみ/);
assert.match(popupDocument, /D: 通常の全処理/);
for (const profileValue of ["mode-a", "mode-b", "mode-c", "mode-aa", "mode-bb", "mode-ac"]) {
  assert.match(popupDocument, new RegExp(`value="${profileValue}"`));
}
assert.match(popupBundle, /detailedLogging/);
assert.match(popupBundle, /diagnosticStage/);
assert.doesNotMatch(popupBundle, /chrome\.tabs\.query/);
assert.doesNotMatch(popupBundle, /chrome\.runtime\.sendMessage/);
assert.match(popupBundle, /\\u8A2D\\u5B9A\\u3092\\u4FDD\\u5B58\\u3057\\u307E\\u3057\\u305F/);
assert.match(popupStyles, /border-bottom:\s*1px solid #ccc/);
assert.match(popupStyles, /background-color:\s*#4caf50/);

assert.equal(contentBundle.includes("eval("), false);
assert.ok((await stat("dist/content.js")).size < 5 * 1024 * 1024);
await access("dist/THIRD_PARTY_NOTICES.md");
assert.deepEqual([...icon.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
assert.equal(icon.readUInt32BE(16), 128);
assert.equal(icon.readUInt32BE(20), 128);

console.log("配布物のManifest、権限、映像フィルター、ライセンス通知を検証しました。");
