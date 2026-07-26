import { TRIconButton } from '@tinyrack/ui/components/icon-button';
import { TRTooltip } from '@tinyrack/ui/components/tooltip';
import { MoonIcon, SunIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type ThemeToggleProps = {
  colorScheme: 'light' | 'dark';
  onToggle: () => void;
  className?: string;
};

export function ThemeToggle({
  colorScheme,
  onToggle,
  /**
   * Unpositioned by default: the auth header bar lays it out. Profile and
   * admin still pass their own positioning classes.
   */
  className = '',
}: ThemeToggleProps) {
  const { t } = useTranslation();

  const label =
    colorScheme === 'dark' ? t('common.theme.dark') : t('common.theme.light');

  const SchemeIcon = colorScheme === 'dark' ? SunIcon : MoonIcon;

  return (
    <div className={className}>
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
