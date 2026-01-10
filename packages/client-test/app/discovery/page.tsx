import Link from 'next/link';
import { oidcConfig } from '@/lib/oidc-config';
import type { JWKS, OpenIDConfiguration } from '@/types/oidc';

async function fetchOpenIDConfiguration(): Promise<OpenIDConfiguration | null> {
  try {
    const res = await fetch(oidcConfig.openid_configuration_uri || '', {
      cache: 'no-store',
    });
    if (!res.ok) {
      return null;
    }
    return res.json();
  } catch {
    return null;
  }
}

async function fetchJWKS(): Promise<JWKS | null> {
  try {
    const res = await fetch(oidcConfig.jwks_uri || '', {
      cache: 'no-store',
    });
    if (!res.ok) {
      return null;
    }
    return res.json();
  } catch {
    return null;
  }
}

export default async function DiscoveryPage() {
  const [config, jwks] = await Promise.all([
    fetchOpenIDConfiguration(),
    fetchJWKS(),
  ]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-6xl flex-col gap-8 bg-white px-16 py-16 dark:bg-black">
        <div className="flex flex-col gap-4">
          <h1 className="font-bold text-4xl text-black tracking-tight dark:text-zinc-50">
            OpenID Connect Discovery
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Test the OIDC Discovery endpoints (OpenID Configuration and JWKS)
          </p>
        </div>

        {/* OpenID Configuration Section */}
        <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-black text-xl dark:text-zinc-50">
              OpenID Provider Configuration
            </h2>
            <span
              className={`rounded-full px-3 py-1 font-medium text-xs ${
                config
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
              }`}
            >
              {config ? 'SUCCESS' : 'FAILED'}
            </span>
          </div>

          <div className="mb-4 space-y-2">
            <div>
              <dt className="font-medium text-black text-sm dark:text-zinc-50">
                Endpoint URL:
              </dt>
              <dd className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                {oidcConfig.openid_configuration_uri}
              </dd>
            </div>
          </div>

          {config ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="mb-2 font-medium text-black text-sm dark:text-zinc-50">
                    Issuer:
                  </h3>
                  <p className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                    {config.issuer}
                  </p>
                </div>
                <div>
                  <h3 className="mb-2 font-medium text-black text-sm dark:text-zinc-50">
                    Authorization Endpoint:
                  </h3>
                  <p className="break-all font-mono text-xs text-zinc-600 dark:text-zinc-400">
                    {config.authorization_endpoint}
                  </p>
                </div>
                <div>
                  <h3 className="mb-2 font-medium text-black text-sm dark:text-zinc-50">
                    Token Endpoint:
                  </h3>
                  <p className="break-all font-mono text-xs text-zinc-600 dark:text-zinc-400">
                    {config.token_endpoint}
                  </p>
                </div>
                <div>
                  <h3 className="mb-2 font-medium text-black text-sm dark:text-zinc-50">
                    JWKS URI:
                  </h3>
                  <p className="break-all font-mono text-xs text-zinc-600 dark:text-zinc-400">
                    {config.jwks_uri}
                  </p>
                </div>
                <div>
                  <h3 className="mb-2 font-medium text-black text-sm dark:text-zinc-50">
                    UserInfo Endpoint:
                  </h3>
                  <p className="break-all font-mono text-xs text-zinc-600 dark:text-zinc-400">
                    {config.userinfo_endpoint || 'N/A'}
                  </p>
                </div>
                <div>
                  <h3 className="mb-2 font-medium text-black text-sm dark:text-zinc-50">
                    Introspection Endpoint:
                  </h3>
                  <p className="break-all font-mono text-xs text-zinc-600 dark:text-zinc-400">
                    {config.introspection_endpoint || 'N/A'}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="mb-2 font-medium text-black text-sm dark:text-zinc-50">
                  Signing Algorithms (RS256):
                </h3>
                <div className="flex flex-wrap gap-2">
                  {config.id_token_signing_alg_values_supported.map((alg) => (
                    <span
                      key={alg}
                      className="rounded bg-blue-100 px-2 py-1 font-mono text-xs text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                    >
                      {alg}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-2 font-medium text-black text-sm dark:text-zinc-50">
                  Supported Scopes:
                </h3>
                <div className="flex flex-wrap gap-2">
                  {config.scopes_supported?.map((scope) => (
                    <span
                      key={scope}
                      className="rounded bg-zinc-100 px-2 py-1 font-mono text-xs text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                    >
                      {scope}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-2 font-medium text-black text-sm dark:text-zinc-50">
                  PKCE Code Challenge Methods:
                </h3>
                <div className="flex flex-wrap gap-2">
                  {config.code_challenge_methods_supported?.map((method) => (
                    <span
                      key={method}
                      className="rounded bg-purple-100 px-2 py-1 font-mono text-xs text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                    >
                      {method}
                    </span>
                  ))}
                </div>
              </div>

              <details className="mt-4">
                <summary className="cursor-pointer font-medium text-black text-sm dark:text-zinc-50">
                  Full Response (JSON)
                </summary>
                <pre className="mt-2 overflow-x-auto rounded bg-zinc-100 p-4 font-mono text-xs text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                  {JSON.stringify(config, null, 2)}
                </pre>
              </details>
            </div>
          ) : (
            <div className="rounded bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-200">
              <p className="font-medium">
                Failed to fetch OpenID Configuration
              </p>
              <p className="mt-1 text-sm">
                Make sure the OIDC provider is running on{' '}
                <code className="font-mono">http://localhost:8080</code>
              </p>
            </div>
          )}
        </div>

        {/* JWKS Section */}
        <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-black text-xl dark:text-zinc-50">
              JSON Web Key Set (JWKS)
            </h2>
            <span
              className={`rounded-full px-3 py-1 font-medium text-xs ${
                jwks
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
              }`}
            >
              {jwks ? 'SUCCESS' : 'FAILED'}
            </span>
          </div>

          <div className="mb-4 space-y-2">
            <div>
              <dt className="font-medium text-black text-sm dark:text-zinc-50">
                Endpoint URL:
              </dt>
              <dd className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                {oidcConfig.jwks_uri}
              </dd>
            </div>
          </div>

          {jwks ? (
            <div className="space-y-4">
              <div>
                <h3 className="mb-3 font-medium text-black text-sm dark:text-zinc-50">
                  Public Keys ({jwks.keys.length}):
                </h3>
                <div className="space-y-3">
                  {jwks.keys.map((key, index) => (
                    <div
                      key={key.kid || index}
                      className="rounded border border-zinc-200 p-4 dark:border-zinc-700"
                    >
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="font-medium text-xs text-zinc-500 dark:text-zinc-400">
                            Key ID (kid)
                          </p>
                          <p className="mt-1 font-mono text-xs text-zinc-800 dark:text-zinc-200">
                            {key.kid}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium text-xs text-zinc-500 dark:text-zinc-400">
                            Algorithm
                          </p>
                          <p className="mt-1 font-mono text-xs text-zinc-800 dark:text-zinc-200">
                            {key.alg}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium text-xs text-zinc-500 dark:text-zinc-400">
                            Key Type
                          </p>
                          <p className="mt-1 font-mono text-xs text-zinc-800 dark:text-zinc-200">
                            {key.kty}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium text-xs text-zinc-500 dark:text-zinc-400">
                            Use
                          </p>
                          <p className="mt-1 font-mono text-xs text-zinc-800 dark:text-zinc-200">
                            {key.use}
                          </p>
                        </div>
                        {key.n && (
                          <div className="col-span-2">
                            <p className="font-medium text-xs text-zinc-500 dark:text-zinc-400">
                              Modulus (n)
                            </p>
                            <p className="mt-1 break-all font-mono text-xs text-zinc-800 dark:text-zinc-200">
                              {key.n.substring(0, 100)}...
                            </p>
                          </div>
                        )}
                        {key.e && (
                          <div className="col-span-2">
                            <p className="font-medium text-xs text-zinc-500 dark:text-zinc-400">
                              Exponent (e)
                            </p>
                            <p className="mt-1 font-mono text-xs text-zinc-800 dark:text-zinc-200">
                              {key.e}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <details className="mt-4">
                <summary className="cursor-pointer font-medium text-black text-sm dark:text-zinc-50">
                  Full Response (JSON)
                </summary>
                <pre className="mt-2 overflow-x-auto rounded bg-zinc-100 p-4 font-mono text-xs text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                  {JSON.stringify(jwks, null, 2)}
                </pre>
              </details>
            </div>
          ) : (
            <div className="rounded bg-red-50 p-4 text-red-800 dark:bg-red-900/20 dark:text-red-200">
              <p className="font-medium">Failed to fetch JWKS</p>
              <p className="mt-1 text-sm">
                Make sure the OIDC provider is running on{' '}
                <code className="font-mono">http://localhost:8080</code>
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-4">
          <Link
            href="/"
            className="flex h-12 items-center justify-center rounded-lg border border-zinc-300 px-6 font-medium text-base text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            Back to Home
          </Link>
        </div>
      </main>
    </div>
  );
}
