import assert from "node:assert/strict";
import { destroyAnime4kPipelineResources } from "../src/gpu-resources.js";

function makeResource(name) {
  return {
    name,
    destroyCount: 0,
    destroy() {
      this.destroyCount += 1;
    }
  };
}

const inputTexture = makeResource("input");
const sharedTexture = makeResource("shared");
const nestedTexture = makeResource("nested");
const strengthBuffer = makeResource("strength");
const strengthBuffer2 = makeResource("strength2");
const cyclicPipeline = {};
cyclicPipeline.pipelines = [cyclicPipeline];
cyclicPipeline.outputTexture = nestedTexture;

const pipelines = [{
  outputTexture: sharedTexture,
  pipelines: [
    {
      outputTexture: sharedTexture,
      textures: [inputTexture, nestedTexture],
      strengthBuffer,
      strengthBuffer2
    },
    { label: "not destroyable" },
    cyclicPipeline
  ]
}, {
  // Originalパイプラインは入力Textureをそのまま出力する。
  outputTexture: inputTexture
}];

assert.equal(destroyAnime4kPipelineResources(pipelines, [inputTexture]), 4);
assert.equal(inputTexture.destroyCount, 0);
assert.equal(sharedTexture.destroyCount, 1);
assert.equal(nestedTexture.destroyCount, 1);
assert.equal(strengthBuffer.destroyCount, 1);
assert.equal(strengthBuffer2.destroyCount, 1);

assert.equal(destroyAnime4kPipelineResources([], [inputTexture]), 0);
console.log("Anime4K GPUリソース解放の動作検証に成功しました。");
