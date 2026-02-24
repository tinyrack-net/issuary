/**
 * Next.js Instrumentation Hook
 * This runs once when the server starts
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

import { initializeOIDCConfig } from '#example-next-basic/lib/oidc-config';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Server-side initialization
    console.log('Initializing OIDC configuration...');
    try {
      await initializeOIDCConfig();
      console.log('✓ OIDC configuration initialized successfully');
    } catch (error) {
      console.error('Failed to initialize OIDC configuration:', error);
      console.warn('Application will use fallback configuration');
    }
  }
}
