import { Toaster } from '#frontend/components/ui/toaster.tsx';
import { AuthBrandHeader } from '#frontend/features/layout/auth-brand-header.tsx';
import { ShellHeaderBar } from '#frontend/features/layout/shell-header-bar.tsx';

type AuthLayoutProps = {
  children: React.ReactNode;
  /**
   * `form` (default) fits a single column of fields. `wide` is for screens
   * that present a list to review before deciding — consent scopes, terms,
   * account selection, recovery codes.
   */
  width?: 'form' | 'wide';
};

const widthClasses: Record<NonNullable<AuthLayoutProps['width']>, string> = {
  form: 'max-w-tinyrack-measure-xl',
  wide: 'max-w-tinyrack-overlay-md',
};

/**
 * The shell every auth screen sits in.
 *
 * A single, flat column keeps the deployment identity and the current task on
 * one reading line at every breakpoint. The column uses auto block margins so
 * short tasks sit centrally while long consent and setup flows keep their
 * viewport padding and scroll instead of overflowing above the canvas.
 */
export function AuthLayout({ children, width = 'form' }: AuthLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-tinyrack-surface">
      <Toaster />
      <ShellHeaderBar />
      <main className="flex flex-1 px-tinyrack-lg py-tinyrack-xl">
        {/*
          The stack owns vertical rhythm so screens compose as a flat list of
          brand, header, alerts, form, and footer blocks. `m-auto` centres both
          axes only when space is available and collapses safely for tall flows.
        */}
        <div
          className={`auth-enter m-auto flex w-full flex-col gap-tinyrack-xl ${widthClasses[width]}`}
        >
          <AuthBrandHeader />
          {children}
        </div>
      </main>
    </div>
  );
}
