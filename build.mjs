import { cp, mkdir, rm } from "node:fs/promises";
import { build } from "esbuild";

const outputDirectory = "dist";

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
await mkdir(`${outputDirectory}/design`, { recursive: true });

await build({
  entryPoints: ["src/background.js", "src/content.js", "src/popup.js"],
  bundle: true,
  outdir: outputDirectory,
  format: "iife",
  target: "chrome113",
  minify: false,
  sourcemap: false,
  loader: { ".wgsl": "text" }
});

await Promise.all([
  cp("public/manifest.json", `${outputDirectory}/manifest.json`),
  cp("public/popup.html", `${outputDirectory}/popup.html`),
  cp("public/popup.css", `${outputDirectory}/popup.css`),
  cp("public/rules.json", `${outputDirectory}/rules.json`),
  cp("design/icon.png", `${outputDirectory}/design/icon.png`),
  cp("THIRD_PARTY_NOTICES.md", `${outputDirectory}/THIRD_PARTY_NOTICES.md`)
]);
