import { useQuery } from '@tanstack/react-query';
import { LanguageSelector } from '@/components/ui/language-selector.js';
import { ThemeToggle } from '@/components/ui/theme-toggle.js';
import { useTheme } from '@/hooks/use-theme.js';
import { appConfigQueryOptions } from '@/queries/config.js';

type AuthPageLayoutProps = {
  children: React.ReactNode;
};

export function AuthPageLayout({ children }: AuthPageLayoutProps) {
  const { themeMode, currentTheme, darkTheme, canToggleTheme, toggleDarkMode } =
    useTheme();
  const isDark = currentTheme === darkTheme;
  const { data: configData } = useQuery(appConfigQueryOptions);

  const backgroundUrl = configData?.app.background_url;

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-base-200 bg-cover p-4"
      style={
        backgroundUrl
          ? {
              backgroundImage: `url(${backgroundUrl})`,
            }
          : undefined
      }
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
