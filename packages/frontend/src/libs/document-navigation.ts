export function signalDocumentNavigation(): void {
  window.dispatchEvent(new Event('issuary-document-navigation'));
}

export function navigateDocument(url: string): void {
  signalDocumentNavigation();
  window.location.assign(url);
}
