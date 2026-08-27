export function getBrowserTestMaxWorkers(
  isCoverage: boolean,
  isChromiumOnly: boolean,
): number | undefined {
  if (isCoverage || isChromiumOnly) {
    return undefined;
  }

  return 1;
}
