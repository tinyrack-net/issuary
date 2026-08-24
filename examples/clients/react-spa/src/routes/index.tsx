import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { TRBadge } from '@tinyrack/ui/components/badge';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRCard } from '@tinyrack/ui/components/card';
import { TRSeparator } from '@tinyrack/ui/components/separator';
import { env } from '#example-react-spa/libs/env.ts';
import {
  buildAuthorizationUrl,
  getOIDCConfig,
} from '#example-react-spa/libs/oidc-client.ts';
import {
  generateNonce,
  generatePKCEPair,
  generateState,
} from '#example-react-spa/libs/pkce.ts';
import { saveAuthState } from '#example-react-spa/libs/token-storage.ts';
export const Route = createFileRoute('/')({
  component: HomePage,
  beforeLoad: ({ context }) => {
    if (context.tokens) {
      throw redirect({ to: '/profile' });
    }
  },
});

function HomePage() {
  const handleLogin = async () => {
    const { code_verifier, code_challenge } = await generatePKCEPair();
    const state = generateState();
    const nonce = generateNonce();

    saveAuthState({ state, code_verifier, nonce });

    const authUrl = buildAuthorizationUrl(state, code_challenge, nonce);
    window.location.href = authUrl;
  };

  const config = getOIDCConfig();

  return (
    <div className="flex min-h-screen items-center justify-center p-tinyrack-lg">
      <TRCard.Root className="w-full max-w-tinyrack-overlay-md">
        <TRCard.Header>
          <TRCard.Title className="text-tinyrack-3xl">
            React SPA OIDC Test Client
          </TRCard.Title>
          <TRCard.Description>
            Test the OpenID Connect authentication flow with your OIDC provider
            using a Public Client (PKCE).
          </TRCard.Description>
        </TRCard.Header>

        <TRCard.Content className="flex flex-col gap-tinyrack-lg">
          <TRButton intent="primary" onClick={handleLogin} uiSize="lg">
            Sign In with OIDC
          </TRButton>

          <TRButton appearance="outline" render={<Link to="/discovery" />}>
            View Discovery Endpoints
          </TRButton>

          <TRSeparator className="my-tinyrack-lg" />

          <div className="rounded-tinyrack-lg border p-tinyrack-lg">
            <h2 className="mb-tinyrack-md font-tinyrack-strong text-tinyrack-lg">
              Test Configuration
            </h2>
            <dl className="space-y-tinyrack-sm text-tinyrack-sm">
              <div className="flex gap-tinyrack-sm">
                <dt className="font-tinyrack-medium">Issuer:</dt>
                <dd className="font-tinyrack-mono text-tinyrack-text-muted">
                  {env.OIDC_ISSUER}
                </dd>
              </div>
              <div className="flex gap-tinyrack-sm">
                <dt className="font-tinyrack-medium">Client ID:</dt>
                <dd className="font-tinyrack-mono text-tinyrack-text-muted">
                  {config.client_id}
                </dd>
              </div>
              <div className="flex gap-tinyrack-sm">
                <dt className="font-tinyrack-medium">Redirect URI:</dt>
                <dd className="font-tinyrack-mono text-tinyrack-text-muted">
                  {config.redirect_uri}
                </dd>
              </div>
              <div className="flex gap-tinyrack-sm">
                <dt className="font-tinyrack-medium">Scope:</dt>
                <dd className="font-tinyrack-mono text-tinyrack-text-muted">
                  {config.scope}
                </dd>
              </div>
              <div className="flex gap-tinyrack-sm">
                <dt className="font-tinyrack-medium">Client Type:</dt>
                <dd>
                  <TRBadge variant="info">Public Client (PKCE)</TRBadge>
                </dd>
              </div>
            </dl>
          </div>
        </TRCard.Content>
      </TRCard.Root>
    </div>
  );
}
