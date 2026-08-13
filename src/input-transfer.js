export const INPUT_TRANSFER_SAMPLE_POINTS = Object.freeze([
  Object.freeze([0.25, 0.25]),
  Object.freeze([0.5, 0.5]),
  Object.freeze([0.75, 0.75])
]);

const MINIMUM_REFERENCE_SIGNAL = 16;
const MAXIMUM_CHANNEL_DIFFERENCE = 16;
const MAXIMUM_MEAN_DIFFERENCE = 8;

export function areDirectTransferSamplesValid(referenceSamples, directSamples) {
  if (referenceSamples.length !== INPUT_TRANSFER_SAMPLE_POINTS.length
    || directSamples.length !== referenceSamples.length) {
    return false;
  }
  const referenceRgb = referenceSamples.flatMap((sample) => sample.slice(0, 3));
  if (Math.max(...referenceRgb) < MINIMUM_REFERENCE_SIGNAL) return false;

  const differences = referenceSamples.flatMap((reference, sampleIndex) => (
    reference.slice(0, 3).map((value, channelIndex) => (
      Math.abs(value - directSamples[sampleIndex][channelIndex])
    ))
  ));
  return Math.max(...differences) <= MAXIMUM_CHANNEL_DIFFERENCE
    && differences.reduce((sum, difference) => sum + difference, 0) / differences.length
      <= MAXIMUM_MEAN_DIFFERENCE;
}
