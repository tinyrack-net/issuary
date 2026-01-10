import { redirect } from 'next/navigation';
import { exchangeCodeForTokens } from '@/lib/oidc-client';
import { getAndClearAuthState, saveTokens } from '@/lib/token-storage';

export default async function CallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; state?: string; error?: string }>;
}) {
  const params = await searchParams;
  const { code, state, error } = params;

  // Check for error response
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <div className="max-w-md rounded-lg border border-red-200 bg-white p-8 dark:border-red-800 dark:bg-black">
          <h1 className="mb-4 font-bold text-2xl text-red-600 dark:text-red-400">
            Authentication Error
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">Error: {error}</p>
          <a
            href="/"
            className="mt-6 inline-block rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  // Validate required parameters
  if (!code || !state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <div className="max-w-md rounded-lg border border-red-200 bg-white p-8 dark:border-red-800 dark:bg-black">
          <h1 className="mb-4 font-bold text-2xl text-red-600 dark:text-red-400">
            Invalid Callback
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Missing required parameters: code or state
          </p>
        </div>
      </div>
    );
  }

  // Get and verify auth state
  const authState = await getAndClearAuthState();

  if (!authState || authState.state !== state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <div className="max-w-md rounded-lg border border-red-200 bg-white p-8 dark:border-red-800 dark:bg-black">
          <h1 className="mb-4 font-bold text-2xl text-red-600 dark:text-red-400">
            State Mismatch
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            The state parameter does not match. This could be a CSRF attack.
          </p>
        </div>
      </div>
    );
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, authState.code_verifier);

    // Save tokens
    await saveTokens(tokens);

    // Redirect to profile page
    redirect('/profile');
  } catch (err) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <div className="max-w-md rounded-lg border border-red-200 bg-white p-8 dark:border-red-800 dark:bg-black">
          <h1 className="mb-4 font-bold text-2xl text-red-600 dark:text-red-400">
            Token Exchange Failed
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            {err instanceof Error ? err.message : 'Unknown error occurred'}
          </p>
          <a
            href="/"
            className="mt-6 inline-block rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Back to Home
          </a>
        </div>
      </div>
    );
  }
}
