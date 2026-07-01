export function percentile(
  values: readonly number[],
  percentileValue: number,
): number {
  const sortedValues = values
    .filter(Number.isFinite)
    .toSorted((left, right) => left - right);

  if (sortedValues.length === 0) {
    return 0;
  }

  const clampedPercentile = Number.isFinite(percentileValue)
    ? Math.min(100, Math.max(0, percentileValue))
    : 0;
  const rank = Math.ceil((clampedPercentile / 100) * sortedValues.length);
  const index = Math.max(0, rank - 1);

  return sortedValues[index] ?? 0;
}
