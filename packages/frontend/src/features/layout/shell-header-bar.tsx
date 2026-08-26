import { TRText } from '@tinyrack/ui/components/text';
import { ThemeToggle } from '#frontend/components/ui/theme-toggle.tsx';
import { LanguageSelector } from '#frontend/features/layout/language-selector.tsx';
import { useBranding } from '#frontend/features/layout/use-branding.ts';
import { useColorScheme } from '#frontend/hooks/use-theme.ts';

type ShellHeaderBarProps = {
  /**
   * Renders the deployment's mark on the leading edge.
   *
   * Off by default: auth screens render their identity in the centred content
   * column, while application screens opt into it here.
   */
  brand?: boolean;
  /** Page-level action, ahead of the presentation controls. */
  actions?: React.ReactNode;
};

/**
 * Presentation controls for every shell.
 *
 * These used to float over the page — the theme toggle pinned to the viewport
 * corner and the language selector centred under the card. Giving them a real
 * bar puts them in the tab order where a header is expected and stops the
 * toggle overlapping content on short viewports.
 *
 * The language selector renders nothing when the deployment fixes a language,
 * so the bar has to stay balanced with only one control in it.
 */
export function ShellHeaderBar({
  brand = false,
  actions,
}: ShellHeaderBarProps) {
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const { title, iconUrl } = useBranding();

  return (
    <div className="flex items-center gap-tinyrack-sm px-tinyrack-lg py-tinyrack-sm">
      {brand && (
        <div className="flex min-w-0 items-center gap-tinyrack-sm">
          {iconUrl && (
            <img
              alt=""
              className="size-tinyrack-xl object-contain"
              src={iconUrl}
            />
          )}
          {title && (
            <TRText as="h1" truncate variant="headingSm" weight="heading">
              {title}
            </TRText>
          )}
        </div>
      )}
      {/*
        `ms-auto` rather than `justify-end` on the row, so the brand can sit on
        the leading edge while the controls stay pinned to the trailing one.
        With no brand and no actions this renders identically to a
        right-justified row.
      */}
      <div className="ms-auto flex items-center gap-tinyrack-sm">
        {actions}
        <LanguageSelector />
        <ThemeToggle colorScheme={colorScheme} onToggle={toggleColorScheme} />
      </div>
    </div>
  );
}
