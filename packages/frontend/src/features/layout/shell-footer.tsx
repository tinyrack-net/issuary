import { LanguageSelector } from '#frontend/features/layout/language-selector.tsx';

/**
 * Presentation controls that belong after the page's primary content.
 *
 * Keeping this in document flow puts it at the viewport edge on short pages
 * and after the content on long pages. The footer collapses completely when a
 * deployment exposes only one language and the selector renders nothing.
 */
export function ShellFooter() {
  return (
    <footer className="flex justify-center px-tinyrack-lg pb-tinyrack-lg empty:hidden">
      <LanguageSelector />
    </footer>
  );
}
