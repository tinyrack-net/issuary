export function signalDocumentNavigation(): boolean {
  return window.dispatchEvent(
    new Event('issuary-document-navigation', { cancelable: true }),
  );
}

export function navigateDocument(url: string): void {
  if (!signalDocumentNavigation()) {
    return;
  }
  window.location.assign(url);
}
