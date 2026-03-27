import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { exchangeCodeForTokens } from '#example-react-spa/libs/oidc-client.ts';
import {
  clearAuthState,
  getAuthState,
  saveTokens,
} from '#example-react-spa/libs/token-storage.ts';

export const Route = createFileRoute('/callback')({
  component: CallbackPage,
});

function CallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');
      const errorParam = params.get('error');
      const errorDescription = params.get('error_description');

      // Check for error response from authorization server
      if (errorParam) {
        setError(`${errorParam}: ${errorDescription || 'Unknown error'}`);
        return;
      }

      // Validate required parameters
      if (!code || !state) {
        setError('Missing code or state parameter');
        return;
      }

      // Get and validate auth state
      const authState = getAuthState();
      if (!authState) {
        setError('No auth state found. Please start the login flow again.');
        return;
      }

      // Verify state matches (CSRF protection)
      if (authState.state !== state) {
        setError('State mismatch - possible CSRF attack');
        clearAuthState();
        return;
      }

      try {
        // Exchange code for tokens
        const tokens = await exchangeCodeForTokens(
          code,
          authState.code_verifier,
        );

        // Save tokens and clear auth state
        saveTokens(tokens);
        clearAuthState();

        // Redirect to profile
        navigate({ to: '/profile' });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(`Token exchange failed: ${message}`);
      }
    };

    handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base-200">
        <div className="card w-full max-w-md bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-error">Authentication Error</h2>
            <p className="text-sm">{error}</p>
            <div className="card-actions mt-4 justify-end">
              <button
                className="btn btn-primary"
                onClick={() => navigate({ to: '/' })}
                type="button"
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-base-200">
      <div className="card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body items-center text-center">
          <span className="loading loading-spinner loading-lg" />
          <p className="mt-4">Processing authentication...</p>
        </div>
      </div>
    </div>
  );
}
