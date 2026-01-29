import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { env } from '@/libs/env';
import { buildAuthorizationUrl, getOIDCConfig } from '@/libs/oidc-client';
import { generateNonce, generatePKCEPair, generateState } from '@/libs/pkce';
import { saveAuthState } from '@/libs/token-storage';

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
    <div className="flex min-h-screen items-center justify-center bg-base-200">
      <div className="card w-full max-w-2xl bg-base-100 shadow-xl">
        <div className="card-body">
          <h1 className="card-title text-3xl">React SPA OIDC Test Client</h1>
          <p className="text-base-content/70">
            Test the OpenID Connect authentication flow with your OIDC provider
            using a Public Client (PKCE).
          </p>

          <div className="mt-6 flex flex-col gap-4">
            <button
              type="button"
              onClick={handleLogin}
              className="btn btn-primary btn-lg"
            >
              Sign In with OIDC
            </button>

            <Link to="/discovery" className="btn btn-outline">
              View Discovery Endpoints
            </Link>
          </div>

          <div className="divider" />

          <div className="rounded-lg bg-base-200 p-4">
            <h2 className="mb-3 font-semibold text-lg">Test Configuration</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex gap-2">
                <dt className="font-medium">Issuer:</dt>
                <dd className="font-mono text-base-content/70">
                  {env.OIDC_ISSUER}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium">Client ID:</dt>
                <dd className="font-mono text-base-content/70">
                  {config.client_id}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium">Redirect URI:</dt>
                <dd className="font-mono text-base-content/70">
                  {config.redirect_uri}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium">Scope:</dt>
                <dd className="font-mono text-base-content/70">
                  {config.scope}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium">Client Type:</dt>
                <dd className="badge badge-info">Public Client (PKCE)</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
