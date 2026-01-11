import { LanguageSelector } from '@/components/ui/language-selector.js';
import { ThemeToggle } from '@/components/ui/theme-toggle.js';
import { useTheme } from '@/hooks/use-theme.js';

const AUTH_BACKGROUND_URL =
  'https://images.unsplash.com/photo-1508163223045-1880bc36e222?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=2071';

type AuthPageLayoutProps = {
  children: React.ReactNode;
};

export function AuthPageLayout({ children }: AuthPageLayoutProps) {
  const { themeMode, currentTheme, darkTheme, canToggleTheme, toggleDarkMode } =
    useTheme();
  const isDark = currentTheme === darkTheme;

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-cover p-4"
      style={{
        backgroundImage: `url(${AUTH_BACKGROUND_URL})`,
      }}
    >
      {canToggleTheme && (
        <ThemeToggle
          themeMode={themeMode}
          isDark={isDark}
          onToggle={toggleDarkMode}
        />
      )}
      <LanguageSelector />
      <div className="card w-full max-w-100 border border-base-200 bg-base-100 p-12 shadow-lg">
        {children}
      </div>
    </div>
  );
}
