import assert from "node:assert/strict";
import { areDirectTransferSamplesValid } from "../src/input-transfer.js";

const reference = [
  [35, 37, 34, 255],
  [166, 160, 148, 255],
  [49, 92, 121, 255]
];

assert.equal(areDirectTransferSamplesValid(reference, reference), true);
assert.equal(areDirectTransferSamplesValid(reference, [
  [38, 36, 35, 255],
  [160, 165, 145, 255],
  [52, 89, 125, 255]
]), true);
assert.equal(areDirectTransferSamplesValid(reference, [
  [0, 0, 0, 255],
  [0, 0, 0, 255],
  [0, 0, 0, 255]
]), false);
assert.equal(areDirectTransferSamplesValid(reference, [
  [34, 37, 35, 255],
  [148, 160, 166, 255],
  [121, 92, 49, 255]
]), false);
assert.equal(areDirectTransferSamplesValid([
  [3, 3, 3, 255],
  [5, 5, 5, 255],
  [8, 8, 8, 255]
], [
  [3, 3, 3, 255],
  [5, 5, 5, 255],
  [8, 8, 8, 255]
]), false, "暗い場面では黒画面を判別できないため高速経路を使わない");
assert.equal(areDirectTransferSamplesValid(reference, reference.slice(0, 2)), false);

console.log("動画直接転送の画素検証を確認しました。");
