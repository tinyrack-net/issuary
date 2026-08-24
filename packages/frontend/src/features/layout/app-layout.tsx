import { Toaster } from '#frontend/components/ui/toaster.tsx';
import { ShellHeaderBar } from '#frontend/features/layout/shell-header-bar.tsx';

type AppLayoutProps = {
  children: React.ReactNode;
  /** Trailing header action — the profile's sign-out. */
  headerActions?: React.ReactNode;
};

/**
 * The shell for signed-in screens that are not the admin console.
 *
 * Shares the auth surface's vocabulary — the canvas, the header bar, the
 * entrance, the token-owned rhythm — but drops the brand panel and runs full
 * width. A settings page is a list of cards to work through, not a single task
 * to focus on, so surrendering the leading columns to a permanent brand column
 * would be paying prime space for decoration.
 *
 * Deliberately not extracted into a wrapper shared with `AuthLayout`: that one
 * is a twelve-column grid because it has a panel to place, and its content
 * stack carries a mobile-only card that would be a box inside a box here.
 * The genuinely shared piece is `ShellHeaderBar`.
 */
export function AppLayout({ children, headerActions }: AppLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-tinyrack-surface">
      {/*
        Profile hosts the TOTP recovery-codes step, which confirms a copy with
        a toast. Without a viewport here that confirmation would go nowhere on
        the one screen where losing the codes is unrecoverable.
      */}
      <Toaster />
      <ShellHeaderBar actions={headerActions} brand />
      <main className="flex flex-1 justify-center px-tinyrack-lg py-tinyrack-xl">
        {/*
          The stack owns vertical rhythm so screens compose as a flat list of
          blocks instead of each one hand-rolling margins that drift apart.
        */}
        <div className="auth-enter flex w-full max-w-tinyrack-overlay-md flex-col gap-tinyrack-xl">
          {children}
        </div>
      </main>
    </div>
  );
}
