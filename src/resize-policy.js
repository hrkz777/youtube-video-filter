const MINIMUM_RESIZE_DIFFERENCE_PIXELS = 4;
const RESIZE_DIFFERENCE_RATIO = 0.005;

function getDimensionThreshold(dimension) {
  return Math.max(
    MINIMUM_RESIZE_DIFFERENCE_PIXELS,
    Math.ceil(dimension * RESIZE_DIFFERENCE_RATIO)
  );
}

export function shouldRestartForResize(previousSize, nextSize) {
  if (!previousSize || !nextSize || nextSize.width <= 1 || nextSize.height <= 1) return false;
  return Math.abs(nextSize.width - previousSize.width) >= getDimensionThreshold(previousSize.width)
    || Math.abs(nextSize.height - previousSize.height) >= getDimensionThreshold(previousSize.height);
}
