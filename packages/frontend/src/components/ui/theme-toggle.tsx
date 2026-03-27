import { CircleHalfIcon, MoonIcon, SunIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import type { Theme, ThemeMode } from '#frontend/queries/config.ts';

type ThemeToggleProps = {
  themeMode: ThemeMode;
  isAutoMode: boolean;
  detectedTheme: Theme;
  darkTheme: Theme;
  onCycle: () => void;
  className?: string;
};

export function ThemeToggle({
  themeMode,
  isAutoMode,
  detectedTheme,
  darkTheme,
  onCycle,
  className = 'fixed start-3 top-3 z-50 sm:absolute sm:start-4 sm:top-4',
}: ThemeToggleProps) {
  const { t } = useTranslation();

  // Determine which icon to show based on theme mode
  const renderIcon = () => {
    if (themeMode === 'system' || isAutoMode) {
      return <CircleHalfIcon className="size-4" weight="fill" />;
    }
    if (themeMode === 'light') {
      return <SunIcon className="size-4" weight="fill" />;
    }
    return <MoonIcon className="size-4" weight="fill" />;
  };

  // Build tooltip label
  const getTooltipLabel = () => {
    if (themeMode === 'system' || isAutoMode) {
      const detectedLabel =
        detectedTheme === darkTheme
          ? t('common.theme.dark')
          : t('common.theme.light');
      return `${t('common.theme.auto')} (${detectedLabel})`;
    }
    if (themeMode === 'light') {
      return t('common.theme.light');
    }
    return t('common.theme.dark');
  };

  return (
    <div
      className={`tooltip tooltip-right ${className}`}
      data-tip={getTooltipLabel()}
    >
      <button
        aria-label={t('common.theme.select')}
        className="btn btn-circle btn-sm"
        data-testid="theme-toggle"
        onClick={onCycle}
        type="button"
      >
        {renderIcon()}
      </button>
    </div>
  );
}
