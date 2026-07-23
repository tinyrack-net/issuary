import { useSuspenseQuery } from '@tanstack/react-query';
import { ThemeToggle } from '#frontend/components/ui/theme-toggle.tsx';
import { LanguageSelector } from '#frontend/features/layout/language-selector.tsx';
import { useColorScheme } from '#frontend/hooks/use-theme.ts';
import { appConfigQueryOptions } from '#frontend/queries/config.ts';

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
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const { data: configData } = useSuspenseQuery(appConfigQueryOptions);

  const backgroundUrl = configData.branding.background_url;

  const containerClass = responsivePadding ? 'p-4 md:p-8' : 'p-4';
  const cardClass = `${maxWidthClasses[maxWidth]}${cardPadding ? ' p-6 sm:p-10' : ''}`;

  return (
    <div
      className={`relative flex min-h-screen flex-col overflow-y-auto bg-background bg-center bg-cover ${containerClass}`}
      style={
        backgroundUrl
          ? {
              backgroundImage: `url(${backgroundUrl})`,
            }
          : undefined
      }
    >
      {backgroundUrl && (
        <div
          aria-hidden
          className="absolute inset-0 bg-background/70 backdrop-blur-[1px]"
        />
      )}
      <ThemeToggle colorScheme={colorScheme} onToggle={toggleColorScheme} />
      <div className="relative z-10 flex flex-1 items-center justify-center py-6">
        <div
          className={`w-full rounded-xl border border-border bg-surface shadow-lg ${cardClass}`}
        >
          {children}
        </div>
      </div>
      <LanguageSelector className="relative z-10 mx-auto mt-3 pb-2" />
    </div>
  );
}
