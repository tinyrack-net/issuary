import { ThemeToggle } from '#frontend/components/ui/theme-toggle.tsx';
import { LanguageSelector } from '#frontend/features/layout/language-selector.tsx';
import { useColorScheme } from '#frontend/hooks/use-theme.ts';

/**
 * Presentation controls for the auth surface.
 *
 * These used to float over the page — the theme toggle pinned to the viewport
 * corner and the language selector centred under the card. Giving them a real
 * bar puts them in the tab order where a header is expected and stops the
 * toggle overlapping content on short viewports.
 *
 * The language selector renders nothing when the deployment fixes a language,
 * so the bar has to stay balanced with only one control in it.
 */
export function AuthHeaderBar() {
  const { colorScheme, toggleColorScheme } = useColorScheme();

  return (
    <div className="flex items-center justify-end gap-tinyrack-sm px-tinyrack-lg py-tinyrack-sm">
      <LanguageSelector />
      <ThemeToggle colorScheme={colorScheme} onToggle={toggleColorScheme} />
    </div>
  );
}
