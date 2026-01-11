import { Moon, Sun } from '@phosphor-icons/react';

type ThemeToggleProps = {
  theme: string;
  onToggle: () => void;
  className?: string;
};

export function ThemeToggle({
  theme,
  onToggle,
  className = 'absolute start-4 top-4',
}: ThemeToggleProps) {
  return (
    <label className={`swap swap-rotate btn btn-circle btn-sm ${className}`}>
      <input type="checkbox" checked={theme === 'dark'} onChange={onToggle} />
      <Sun className="swap-off size-4" weight="fill" />
      <Moon className="swap-on size-4" weight="fill" />
    </label>
  );
}
