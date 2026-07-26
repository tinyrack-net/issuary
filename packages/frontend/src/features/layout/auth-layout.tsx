import { AuthBrandPanel } from '#frontend/features/layout/auth-brand-panel.tsx';
import { AuthHeaderBar } from '#frontend/features/layout/auth-header-bar.tsx';

type AuthLayoutProps = {
  children: React.ReactNode;
  /**
   * `form` (default) fits a single column of fields. `wide` is for screens
   * that present a list to review before deciding — consent scopes, terms,
   * account selection, recovery codes.
   */
  width?: 'form' | 'wide';
  /**
   * Replays the entry animation when it changes. Pass a wizard step so each
   * step animates in; leave unset for a plain screen.
   */
  animationKey?: string;
};

const widthClasses: Record<NonNullable<AuthLayoutProps['width']>, string> = {
  form: 'max-w-tinyrack-measure-xl',
  wide: 'max-w-tinyrack-measure-2xl',
};

/**
 * The shell every auth screen sits in.
 *
 * Split canvas: the deployment's identity on the left, the task on the right.
 * The form is not in a card on desktop — hierarchy comes from the contrast
 * between the inverse brand panel and the canvas, so a card would only add a
 * box inside a box. Below `md:` the panel collapses to a banner and the form
 * does get a surface, because on a phone it would otherwise float unanchored.
 */
export function AuthLayout({
  children,
  width = 'form',
  animationKey,
}: AuthLayoutProps) {
  return (
    <div className="grid min-h-dvh grid-cols-1 bg-tinyrack-canvas md:grid-cols-12">
      <AuthBrandPanel />
      <div className="col-span-full flex min-w-0 flex-col md:col-span-8 lg:col-span-7">
        <AuthHeaderBar />
        <main className="flex flex-1 items-center justify-center px-tinyrack-lg py-tinyrack-xl">
          {/*
            The stack owns vertical rhythm so screens compose as a flat list of
            blocks — header, alerts, form, footer — instead of each one
            hand-rolling `mb-4`/`mt-6` margins that drift apart over time.
          */}
          <div
            className={`auth-enter flex w-full flex-col gap-tinyrack-xl rounded-tinyrack-xl border border-tinyrack-border bg-tinyrack-surface p-tinyrack-xl md:border-0 md:bg-transparent md:p-0 ${widthClasses[width]}`}
            key={animationKey}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
