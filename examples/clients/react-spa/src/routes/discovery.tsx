import { createFileRoute, Link } from '@tanstack/react-router';
import { TRButton } from '@tinyrack/ui/components/button';
import { TRCard } from '@tinyrack/ui/components/card';
import { TRCode } from '@tinyrack/ui/components/code';
import { TRSpinner } from '@tinyrack/ui/components/spinner';
import { useEffect, useState } from 'react';
import { env } from '#example-react-spa/libs/env.ts';
import {
  fetchJWKS,
  fetchOpenIDConfiguration,
  isOIDCConfigInitialized,
} from '#example-react-spa/libs/oidc-client.ts';
import type {
  JWKS,
  OpenIDConfiguration,
} from '#example-react-spa/types/oidc.ts';
export const Route = createFileRoute('/discovery')({
  component: DiscoveryPage,
});

function DiscoveryPage() {
  const [discovery, setDiscovery] = useState<OpenIDConfiguration | null>(null);
  const [jwks, setJwks] = useState<JWKS | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const disc = await fetchOpenIDConfiguration(env.OIDC_ISSUER);
        setDiscovery(disc);

        if (isOIDCConfigInitialized()) {
          const jwksData = await fetchJWKS();
          setJwks(jwksData);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-tinyrack-lg">
        <TRSpinner uiSize="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-tinyrack-lg">
        <TRCard.Root className="w-full max-w-tinyrack-measure-xl">
          <TRCard.Header>
            <TRCard.Title className="text-tinyrack-danger-foreground">
              Error
            </TRCard.Title>
            <TRCard.Description>{error}</TRCard.Description>
          </TRCard.Header>
          <TRCard.Footer className="justify-end">
            <TRButton intent="primary" render={<Link to="/" />}>
              Back to Home
            </TRButton>
          </TRCard.Footer>
        </TRCard.Root>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-tinyrack-2xl">
      <div className="mx-auto max-w-tinyrack-overlay-width-md space-y-tinyrack-xl">
        <TRCard.Root>
          <TRCard.Header>
            <TRCard.Title className="text-tinyrack-3xl">
              OpenID Discovery
            </TRCard.Title>
            <TRCard.Description>
              OpenID Provider metadata from{' '}
              <TRCode>
                {env.OIDC_ISSUER}/.well-known/openid-configuration
              </TRCode>
            </TRCard.Description>
          </TRCard.Header>
        </TRCard.Root>

        {discovery && (
          <TRCard.Root>
            <TRCard.Header>
              <TRCard.Title>OpenID Configuration</TRCard.Title>
            </TRCard.Header>
            <TRCard.Content>
              <pre className="overflow-x-auto rounded border p-tinyrack-lg font-tinyrack-mono text-tinyrack-xs">
                {JSON.stringify(discovery, null, 2)}
              </pre>
            </TRCard.Content>
          </TRCard.Root>
        )}

        {jwks && (
          <TRCard.Root>
            <TRCard.Header>
              <TRCard.Title>JSON Web Key Set (JWKS)</TRCard.Title>
              <TRCard.Description>
                Public keys used to verify JWT signatures
              </TRCard.Description>
            </TRCard.Header>
            <TRCard.Content>
              <pre className="overflow-x-auto rounded border p-tinyrack-lg font-tinyrack-mono text-tinyrack-xs">
                {JSON.stringify(jwks, null, 2)}
              </pre>
            </TRCard.Content>
          </TRCard.Root>
        )}

        <div className="flex gap-tinyrack-lg">
          <TRButton appearance="outline" render={<Link to="/" />}>
            Back to Home
          </TRButton>
        </div>
      </div>
    </div>
  );
}
