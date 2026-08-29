function getGreatestCommonDivisor(left, right) {
  left = Math.abs(Math.trunc(left));
  right = Math.abs(Math.trunc(right));
  while (right !== 0) {
    [left, right] = [right, left % right];
  }
  return Math.max(left, 1);
}

function getContentScale(sourceWidth, sourceHeight, boxWidth, boxHeight, objectFit) {
  const containScale = Math.min(boxWidth / sourceWidth, boxHeight / sourceHeight);
  switch (objectFit) {
    case "cover":
      return Math.max(boxWidth / sourceWidth, boxHeight / sourceHeight);
    case "none":
      return 1;
    case "scale-down":
      return Math.min(1, containScale);
    default:
      return containScale;
  }
}

function scaleToMaximumDimension(width, height, maximumDimension) {
  const scale = Math.min(1, maximumDimension / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

export function getVideoBackingSize({
  sourceWidth,
  sourceHeight,
  boxWidth,
  boxHeight,
  objectFit = "fill",
  pixelRatio = 1,
  maximumDimension = 4096
}) {
  if (![sourceWidth, sourceHeight, boxWidth, boxHeight, pixelRatio, maximumDimension]
    .every((value) => Number.isFinite(value) && value > 0)) {
    return { width: 1, height: 1 };
  }

  if (objectFit === "fill") {
    return scaleToMaximumDimension(
      Math.max(1, Math.round(boxWidth * pixelRatio)),
      Math.max(1, Math.round(boxHeight * pixelRatio)),
      maximumDimension
    );
  }

  const divisor = getGreatestCommonDivisor(sourceWidth, sourceHeight);
  const aspectUnitWidth = Math.trunc(sourceWidth) / divisor;
  const aspectUnitHeight = Math.trunc(sourceHeight) / divisor;
  const maximumMultiplier = Math.floor(
    maximumDimension / Math.max(aspectUnitWidth, aspectUnitHeight)
  );
  if (maximumMultiplier < 1) {
    return scaleToMaximumDimension(sourceWidth, sourceHeight, maximumDimension);
  }

  const contentScale = getContentScale(
    sourceWidth,
    sourceHeight,
    boxWidth,
    boxHeight,
    objectFit
  );
  const usesNaturalSize = objectFit === "none"
    || (objectFit === "scale-down" && contentScale === 1);
  const backingPixelRatio = usesNaturalSize ? 1 : pixelRatio;
  const requestedWidth = sourceWidth * contentScale * backingPixelRatio;
  const requestedHeight = sourceHeight * contentScale * backingPixelRatio;
  const requestedMultiplier = Math.max(
    1,
    Math.round((
      requestedWidth / aspectUnitWidth
      + requestedHeight / aspectUnitHeight
    ) / 2)
  );
  const multiplier = Math.min(requestedMultiplier, maximumMultiplier);
  return {
    width: aspectUnitWidth * multiplier,
    height: aspectUnitHeight * multiplier
  };
}
