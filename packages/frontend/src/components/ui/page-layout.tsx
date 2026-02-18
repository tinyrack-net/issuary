import { LanguageSelector } from '@frontend/components/ui/language-selector.js';
import { ThemeToggle } from '@frontend/components/ui/theme-toggle.js';
import { useTheme } from '@frontend/hooks/use-theme.js';
import { appConfigQueryOptions } from '@frontend/queries/config.js';
import { useSuspenseQuery } from '@tanstack/react-query';

type PageLayoutProps = {
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '100';
  cardPadding?: boolean;
  responsivePadding?: boolean;
};

const maxWidthClasses: Record<
  NonNullable<PageLayoutProps['maxWidth']>,
  string
> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '100': 'max-w-100',
};

export function PageLayout({
  children,
  maxWidth = '100',
  cardPadding = false,
  responsivePadding = false,
}: PageLayoutProps) {
  const {
    themeMode,
    darkTheme,
    canToggleTheme,
    cycleThemeMode,
    isAutoMode,
    detectedTheme,
  } = useTheme();
  const { data: configData } = useSuspenseQuery(appConfigQueryOptions);

  const backgroundUrl = configData.app.background_url;

  const containerClass = responsivePadding ? 'p-4 md:p-8' : 'p-4';
  const cardClass = `${maxWidthClasses[maxWidth]}${cardPadding ? ' p-10' : ''}`;

  return (
    <div
      className={`relative flex min-h-screen flex-col bg-base-200 bg-cover ${containerClass}`}
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
          className="fixed start-3 top-3 z-50 sm:absolute sm:start-4 sm:top-4"
          darkTheme={darkTheme}
          detectedTheme={detectedTheme}
          isAutoMode={isAutoMode}
          onCycle={cycleThemeMode}
          themeMode={themeMode}
        />
      )}
      <div className="flex flex-1 items-center justify-center">
        <div
          className={`card w-full border border-base-200 bg-base-100 shadow-lg ${cardClass}`}
        >
          {children}
        </div>
      </div>
      <LanguageSelector className="mx-auto mt-4 pb-2" />
    </div>
  );
}
