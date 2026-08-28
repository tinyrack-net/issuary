export function isFirefoxNavigationAbort(error: unknown): boolean {
  const message = String(error instanceof Error ? error.message : error);
  return (
    message.includes('NS_BINDING_ABORTED') ||
    message.includes('NS_ERROR_FAILURE') ||
    message.includes('is interrupted by another navigation')
  );
}
