import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";

const manifest = JSON.parse(await readFile("dist/manifest.json", "utf8"));
const rules = JSON.parse(await readFile("dist/rules.json", "utf8"));
const contentBundle = await readFile("dist/content.js", "utf8");
const popupDocument = await readFile("dist/popup.html", "utf8");
const popupBundle = await readFile("dist/popup.js", "utf8");

assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.name, "YouTube Video Filter");
assert.equal(manifest.version, "0.2.0");
assert.deepEqual(manifest.content_scripts[0].matches, ["https://www.youtube.com/*"]);
assert.deepEqual(manifest.host_permissions, [
  "https://www.youtube.com/*",
  "https://*.googlevideo.com/*"
]);
assert.equal(manifest.host_permissions.includes("<all_urls>"), false);
assert.equal(manifest.permissions.includes("activeTab"), false);
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
assert.match(contentBundle, /visibility\s*=\s*["']hidden["']/);
assert.match(contentBundle, /elementsFromPoint/);
assert.match(contentBundle, /ResizeObserver/);
assert.match(contentBundle, /videoBounds\.height/);
assert.match(contentBundle, /chrome\.storage\.onChanged/);
assert.match(contentBundle, /cancelActiveProcessing/);
assert.match(contentBundle, /ytp-youtube-filter-button/);
assert.match(contentBundle, /ytp-right-controls/);
assert.match(contentBundle, /controls\.firstElementChild/);
assert.match(contentBundle, /@media \(hover: hover\) and \(pointer: fine\)/);
assert.match(contentBundle, /#movie_player:hover/);
assert.match(contentBundle, /4 2 17 17/);
assert.match(contentBundle, /aria-haspopup/);
assert.match(contentBundle, /aria-expanded/);
assert.match(contentBundle, /menuitemradio/);
assert.match(contentBundle, /optionSetting/);
assert.match(contentBundle, /ytp-panel-menu/);
assert.match(contentBundle, /ytp-popup ytp-settings-menu/);
assert.match(contentBundle, /ytp-settings-menu:not\(\[hidden\]\)/);
assert.match(contentBundle, /display:\s*block\s*!important/);
assert.match(contentBundle, /ytp-popup-content/);
assert.match(contentBundle, /ytp-menuitem-toggle-checkbox/);
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
assert.match(popupDocument, /A: 入力映像のみ/);
assert.match(popupDocument, /D: 通常の全処理/);
for (const profileValue of ["mode-a", "mode-b", "mode-c", "mode-aa", "mode-bb", "mode-ac"]) {
  assert.match(popupDocument, new RegExp(`value="${profileValue}"`));
}
assert.match(popupBundle, /detailedLogging/);
assert.match(popupBundle, /diagnosticStage/);

assert.equal(contentBundle.includes("eval("), false);
assert.ok((await stat("dist/content.js")).size < 5 * 1024 * 1024);
await access("dist/THIRD_PARTY_NOTICES.md");

console.log("配布物のManifest、権限、映像フィルター、ライセンス通知を検証しました。");
