import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { TRAlert } from '@tinyrack/ui/components/alert';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRCard } from '@tinyrack/ui/components/card';
import { TRSpinner } from '@tinyrack/ui/components/spinner';
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

      if (errorParam) {
        setError(`${errorParam}: ${errorDescription || 'Unknown error'}`);
        return;
      }

      if (!code || !state) {
        setError('Missing code or state parameter');
        return;
      }

      const authState = getAuthState();
      if (!authState) {
        setError('No auth state found. Please start the login flow again.');
        return;
      }

      if (authState.state !== state) {
        setError('State mismatch - possible CSRF attack');
        clearAuthState();
        return;
      }

      try {
        const tokens = await exchangeCodeForTokens(
          code,
          authState.code_verifier,
        );

        saveTokens(tokens);
        clearAuthState();

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
      <div className="flex min-h-screen items-center justify-center p-tinyrack-lg">
        <TRCard.Root className="w-full max-w-tinyrack-measure-xl">
          <TRCard.Header>
            <TRCard.Title className="text-tinyrack-danger-foreground">
              Authentication Error
            </TRCard.Title>
            <TRCard.Description>
              <TRAlert.Root variant="danger">
                <TRAlert.Description>{error}</TRAlert.Description>
              </TRAlert.Root>
            </TRCard.Description>
          </TRCard.Header>
          <TRCard.Footer className="justify-end">
            <TRButton
              intent="primary"
              onClick={() => navigate({ to: '/' })}
              type="button"
            >
              Back to Home
            </TRButton>
          </TRCard.Footer>
        </TRCard.Root>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-tinyrack-lg">
      <TRCard.Root className="w-full max-w-tinyrack-measure-xl">
        <TRCard.Content className="flex flex-col items-center gap-tinyrack-lg text-center">
          <TRSpinner uiSize="lg" />
          <p>Processing authentication...</p>
        </TRCard.Content>
      </TRCard.Root>
    </div>
  );
}
