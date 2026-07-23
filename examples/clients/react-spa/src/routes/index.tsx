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
    <div className="flex min-h-screen items-center justify-center p-4">
      <TRCard.Root className="w-full max-w-2xl">
        <TRCard.Header>
          <TRCard.Title className="text-3xl">
            React SPA OIDC Test Client
          </TRCard.Title>
          <TRCard.Description>
            Test the OpenID Connect authentication flow with your OIDC provider
            using a Public Client (PKCE).
          </TRCard.Description>
        </TRCard.Header>

        <TRCard.Content className="flex flex-col gap-4">
          <TRButton intent="primary" onClick={handleLogin} uiSize="lg">
            Sign In with OIDC
          </TRButton>

          <TRButton appearance="outline" render={<Link to="/discovery" />}>
            View Discovery Endpoints
          </TRButton>

          <TRSeparator className="my-4" />

          <div className="rounded-lg border p-4">
            <h2 className="mb-3 font-semibold text-lg">Test Configuration</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex gap-2">
                <dt className="font-medium">Issuer:</dt>
                <dd className="font-mono text-muted-foreground">
                  {env.OIDC_ISSUER}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium">Client ID:</dt>
                <dd className="font-mono text-muted-foreground">
                  {config.client_id}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium">Redirect URI:</dt>
                <dd className="font-mono text-muted-foreground">
                  {config.redirect_uri}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium">Scope:</dt>
                <dd className="font-mono text-muted-foreground">
                  {config.scope}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium">Client Type:</dt>
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
