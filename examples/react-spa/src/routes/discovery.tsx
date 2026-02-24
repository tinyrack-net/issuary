import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { env } from '#example-react-spa/libs/env.js';
import {
  fetchJWKS,
  fetchOpenIDConfiguration,
  isOIDCConfigInitialized,
} from '#example-react-spa/libs/oidc-client.js';
import type {
  JWKS,
  OpenIDConfiguration,
} from '#example-react-spa/types/oidc.js';

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
      <div className="flex min-h-screen items-center justify-center bg-base-200">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base-200">
        <div className="card w-full max-w-md bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-error">Error</h2>
            <p className="text-sm">{error}</p>
            <div className="card-actions mt-4 justify-end">
              <Link className="btn btn-primary" to="/">
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h1 className="card-title text-3xl">OpenID Discovery</h1>
            <p className="text-base-content/70">
              OpenID Provider metadata from{' '}
              <code className="text-sm">
                {env.OIDC_ISSUER}/.well-known/openid-configuration
              </code>
            </p>
          </div>
        </div>

        {discovery && (
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">OpenID Configuration</h2>
              <pre className="overflow-x-auto rounded bg-base-200 p-4 font-mono text-xs">
                {JSON.stringify(discovery, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {jwks && (
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">JSON Web Key Set (JWKS)</h2>
              <p className="text-base-content/70 text-sm">
                Public keys used to verify JWT signatures
              </p>
              <pre className="mt-4 overflow-x-auto rounded bg-base-200 p-4 font-mono text-xs">
                {JSON.stringify(jwks, null, 2)}
              </pre>
            </div>
          </div>
        )}

        <div className="flex gap-4">
          <Link className="btn btn-outline" to="/">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
