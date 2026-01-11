import { MoonIcon, SunIcon } from '@phosphor-icons/react';
import type { ThemeMode } from '@/queries/config';

type ThemeToggleProps = {
  themeMode: ThemeMode;
  isDark: boolean;
  onToggle: () => void;
  className?: string;
};

export function ThemeToggle({
  isDark,
  onToggle,
  className = 'absolute start-4 top-4',
}: ThemeToggleProps) {
  return (
    <label className={`swap swap-rotate btn btn-circle btn-sm ${className}`}>
      <input type="checkbox" checked={isDark} onChange={onToggle} />
      <SunIcon className="swap-off size-4" weight="fill" />
      <MoonIcon className="swap-on size-4" weight="fill" />
    </label>
  );
}
