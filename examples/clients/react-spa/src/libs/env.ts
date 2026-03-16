/**
 * Environment configuration loaded from Vite env variables
 */
export const env = {
  OIDC_ISSUER: import.meta.env.VITE_OIDC_ISSUER || 'http://localhost:8080',
  OIDC_CLIENT_ID: import.meta.env.VITE_OIDC_CLIENT_ID || 'react-spa-client',
  OIDC_REDIRECT_URI:
    import.meta.env.VITE_OIDC_REDIRECT_URI || 'http://localhost:3001/callback',
  OIDC_SCOPE: import.meta.env.VITE_OIDC_SCOPE || 'openid profile email',
};
