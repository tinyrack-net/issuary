import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTokens } from '@/lib/token-storage';

export default async function Home() {
  const tokens = await getTokens();

  if (tokens) {
    redirect('/profile');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col items-center gap-8 bg-white px-16 py-32 dark:bg-black">
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="font-bold text-4xl text-black tracking-tight dark:text-zinc-50">
            OIDC Test Client
          </h1>
          <p className="max-w-md text-lg text-zinc-600 leading-8 dark:text-zinc-400">
            Test the OpenID Connect authentication flow with your OIDC provider.
          </p>
        </div>

        <div className="flex w-full flex-col gap-4">
          <Link
            className="flex h-12 items-center justify-center rounded-lg bg-blue-600 px-6 font-medium text-base text-white transition-colors hover:bg-blue-700"
            href="/api/auth/login"
          >
            Sign In with OIDC
          </Link>

          <Link
            className="flex h-12 items-center justify-center rounded-lg border border-blue-600 px-6 font-medium text-base text-blue-600 transition-colors hover:bg-blue-50 dark:border-blue-500 dark:text-blue-500 dark:hover:bg-blue-950"
            href="/discovery"
          >
            View Discovery Endpoints
          </Link>

          <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
            <h2 className="mb-3 font-semibold text-black text-lg dark:text-zinc-50">
              Test Configuration
            </h2>
            <dl className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <div>
                <dt className="font-medium text-black dark:text-zinc-50">
                  Issuer:
                </dt>
                <dd className="font-mono">http://localhost:8080</dd>
              </div>
              <div>
                <dt className="font-medium text-black dark:text-zinc-50">
                  Client ID:
                </dt>
                <dd className="font-mono">sdlk3n3dkj2</dd>
              </div>
              <div>
                <dt className="font-medium text-black dark:text-zinc-50">
                  Redirect URI:
                </dt>
                <dd className="font-mono">
                  http://localhost:3000/api/callback
                </dd>
              </div>
              <div>
                <dt className="font-medium text-black dark:text-zinc-50">
                  Scope:
                </dt>
                <dd className="font-mono">openid profile email</dd>
              </div>
            </dl>
          </div>
        </div>
      </main>
    </div>
  );
}
