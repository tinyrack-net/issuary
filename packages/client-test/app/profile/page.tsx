import Link from 'next/link';
import { redirect } from 'next/navigation';
import { decodeIDToken } from '@/lib/oidc-client';
import { getTokens } from '@/lib/token-storage';
import { IntrospectSection } from './introspect-section';

export default async function ProfilePage() {
  const tokens = await getTokens();

  if (!tokens) {
    redirect('/');
  }

  const idTokenPayload = tokens.id_token
    ? decodeIDToken(tokens.id_token)
    : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-4xl flex-col gap-8 bg-white px-16 py-32 dark:bg-black">
        <div className="flex flex-col gap-4">
          <h1 className="font-bold text-4xl text-black tracking-tight dark:text-zinc-50">
            Authentication Successful
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            You have successfully authenticated using OIDC.
          </p>
        </div>

        {idTokenPayload && (
          <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
            <h2 className="mb-4 font-semibold text-black text-xl dark:text-zinc-50">
              User Information (from ID Token)
            </h2>
            <dl className="space-y-3">
              <div className="grid grid-cols-4 gap-4">
                <dt className="font-medium text-black dark:text-zinc-50">
                  Subject (sub):
                </dt>
                <dd className="col-span-3 font-mono text-sm text-zinc-600 dark:text-zinc-400">
                  {idTokenPayload.sub}
                </dd>
              </div>
              {idTokenPayload.email && (
                <div className="grid grid-cols-4 gap-4">
                  <dt className="font-medium text-black dark:text-zinc-50">
                    Email:
                  </dt>
                  <dd className="col-span-3 font-mono text-sm text-zinc-600 dark:text-zinc-400">
                    {idTokenPayload.email}
                  </dd>
                </div>
              )}
              {idTokenPayload.name && (
                <div className="grid grid-cols-4 gap-4">
                  <dt className="font-medium text-black dark:text-zinc-50">
                    Name:
                  </dt>
                  <dd className="col-span-3 font-mono text-sm text-zinc-600 dark:text-zinc-400">
                    {idTokenPayload.name}
                  </dd>
                </div>
              )}
              <div className="grid grid-cols-4 gap-4">
                <dt className="font-medium text-black dark:text-zinc-50">
                  Issued At:
                </dt>
                <dd className="col-span-3 font-mono text-sm text-zinc-600 dark:text-zinc-400">
                  {new Date(idTokenPayload.iat * 1000).toLocaleString()}
                </dd>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <dt className="font-medium text-black dark:text-zinc-50">
                  Expires At:
                </dt>
                <dd className="col-span-3 font-mono text-sm text-zinc-600 dark:text-zinc-400">
                  {new Date(idTokenPayload.exp * 1000).toLocaleString()}
                </dd>
              </div>
            </dl>
          </div>
        )}

        <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
          <h2 className="mb-4 font-semibold text-black text-xl dark:text-zinc-50">
            Tokens
          </h2>
          <div className="space-y-4">
            <div>
              <h3 className="mb-2 font-medium text-black text-sm dark:text-zinc-50">
                Access Token:
              </h3>
              <pre className="overflow-x-auto rounded bg-zinc-100 p-3 font-mono text-xs text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                {tokens.access_token}
              </pre>
            </div>
            {tokens.refresh_token && (
              <div>
                <h3 className="mb-2 font-medium text-black text-sm dark:text-zinc-50">
                  Refresh Token:
                </h3>
                <pre className="overflow-x-auto rounded bg-zinc-100 p-3 font-mono text-xs text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                  {tokens.refresh_token}
                </pre>
              </div>
            )}
            {tokens.id_token && (
              <div>
                <h3 className="mb-2 font-medium text-black text-sm dark:text-zinc-50">
                  ID Token:
                </h3>
                <pre className="overflow-x-auto rounded bg-zinc-100 p-3 font-mono text-xs text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                  {tokens.id_token}
                </pre>
              </div>
            )}
          </div>
        </div>

        {idTokenPayload && (
          <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
            <h2 className="mb-4 font-semibold text-black text-xl dark:text-zinc-50">
              ID Token Payload (Decoded)
            </h2>
            <pre className="overflow-x-auto rounded bg-zinc-100 p-4 font-mono text-xs text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
              {JSON.stringify(idTokenPayload, null, 2)}
            </pre>
          </div>
        )}

        <IntrospectSection
          accessToken={tokens.access_token}
          refreshToken={tokens.refresh_token}
        />

        <div className="flex flex-wrap gap-4">
          <Link
            href="/api/auth/logout"
            className="flex h-12 items-center justify-center rounded-lg bg-red-600 px-6 font-medium text-base text-white transition-colors hover:bg-red-700"
          >
            Logout
          </Link>
          <Link
            href="/discovery"
            className="flex h-12 items-center justify-center rounded-lg border border-zinc-300 px-6 font-medium text-base text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            Discovery Endpoints
          </Link>
          <Link
            href="/"
            className="flex h-12 items-center justify-center rounded-lg border border-zinc-300 px-6 font-medium text-base text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            Home
          </Link>
        </div>
      </main>
    </div>
  );
}
