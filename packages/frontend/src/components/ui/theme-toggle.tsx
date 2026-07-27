import { TRIconButton } from '@tinyrack/ui/components/icon-button';
import { TRTooltip } from '@tinyrack/ui/components/tooltip';
import { MoonIcon, SunIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type ThemeToggleProps = {
  colorScheme: 'light' | 'dark';
  onToggle: () => void;
};

/**
 * Carries no positioning of its own. Every shell now lays this out in a real
 * header bar; it used to be pinned to the viewport corner with `fixed`, where
 * it overlapped content on short screens.
 */
export function ThemeToggle({ colorScheme, onToggle }: ThemeToggleProps) {
  const { t } = useTranslation();

  const label =
    colorScheme === 'dark' ? t('common.theme.dark') : t('common.theme.light');

  const SchemeIcon = colorScheme === 'dark' ? SunIcon : MoonIcon;

  return (
    <div>
      <TRTooltip.Root>
        <TRTooltip.Trigger
          data-testid="theme-toggle"
          render={
            <TRIconButton
              appearance="ghost"
              aria-label={label}
              onClick={onToggle}
            >
              <SchemeIcon />
            </TRIconButton>
          }
        />
        <TRTooltip.Portal>
          <TRTooltip.Positioner>
            <TRTooltip.Popup>{label}</TRTooltip.Popup>
            <TRTooltip.Arrow />
          </TRTooltip.Positioner>
        </TRTooltip.Portal>
      </TRTooltip.Root>
    </div>
  );
}
