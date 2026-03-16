# OIDC Test Client

A Next.js-based client application for testing OpenID Connect (OIDC) Providers.

## Features

- ✅ **Authorization Code Flow with PKCE** - Secure OAuth 2.0 authentication flow
- ✅ **Automatic OIDC Discovery** - Fetches provider configuration from `.well-known/openid-configuration`
- ✅ **Environment-based Configuration** - Configure via environment variables
- ✅ **ID Token Verification & Decoding** - JWT-based user information verification
- ✅ **Token Storage & Management** - Secure token storage using httpOnly cookies
- ✅ **User Information Display** - Decode and display ID Token claims
- ✅ **Token Introspection (RFC 7662)** - Verify token status and metadata
- ✅ **Logout Functionality** - Token deletion and session termination

## Project Structure

```
nextjs-ssr/
├── app/
│   ├── page.tsx                          # Main page (login button)
│   ├── profile/
│   │   ├── page.tsx                      # Profile page after authentication
│   │   └── introspect-section.tsx        # Token introspection UI component
│   └── api/
│       ├── auth/
│       │   ├── login/route.ts            # OIDC authentication start
│       │   └── logout/route.ts           # Logout handler
│       ├── callback/route.ts             # OAuth callback handler
│       └── introspect/route.ts           # Token introspection endpoint
├── lib/
│   ├── oidc-config.ts                    # OIDC configuration
│   ├── oidc-client.ts                    # OIDC client utilities
│   ├── pkce.ts                           # PKCE utilities
│   └── token-storage.ts                  # Token storage/management
└── types/
    └── oidc.ts                           # TypeScript type definitions
```

## Configuration

### Environment Variables Setup (Recommended)

Create a `.env.local` file from the example:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:

```env
# OpenID Connect Configuration
OIDC_ISSUER=http://localhost:8080

# OAuth Client Credentials
OIDC_CLIENT_ID=sdlk3n3dkj2
OIDC_CLIENT_SECRET=sdlk3n3dkj2

# Redirect URI (must match client registration)
OIDC_REDIRECT_URI=http://localhost:3000/api/callback

# OAuth Scopes (space-separated)
OIDC_SCOPE=openid profile email

# Discovery Options (optional)
OIDC_DISCOVERY_RETRY_ENABLED=true
OIDC_DISCOVERY_MAX_RETRIES=3
OIDC_DISCOVERY_RETRY_DELAY_MS=1000
```

The application will automatically fetch all endpoint URLs from the OIDC Provider's `.well-known/openid-configuration` endpoint on startup.

### Manual OIDC Provider Configuration (Legacy)

Alternatively, you can manually configure endpoints in `lib/oidc-config.ts` (not recommended):

```typescript
export const oidcConfig: OIDCConfig = {
  issuer: 'http://localhost:8080',
  authorization_endpoint: 'http://localhost:8080/oauth/authorize',
  token_endpoint: 'http://localhost:8080/oauth/token',
  userinfo_endpoint: 'http://localhost:8080/oauth/userinfo',
  introspection_endpoint: 'http://localhost:8080/oauth/introspect',
  
  client_id: 'sdlk3n3dkj2',
  client_secret: 'sdlk3n3dkj2',
  redirect_uri: 'http://localhost:3000/api/callback',
  
  scope: 'openid profile email',
  response_type: 'code',
};
```

### Backend OIDC Provider Configuration

The following OAuth Client must be registered in the backend's `config.yaml`:

```yaml
providers:
  - id: test-config-oauth-client
    name: My App
    client_id: sdlk3n3dkj2
    client_secret: sdlk3n3dkj2
    redirect_uris:
      - http://localhost:3000/callback
    response_types:
      - code
    grant_types:
      - authorization_code
    scope: openid profile email
```

## Running the Application

### Development Mode

```bash
pnpm dev
```

The app will run at http://localhost:3000

### Production Build

```bash
pnpm build
pnpm start
```

## Usage

1. **Start Backend OIDC Provider**
   ```bash
   cd packages/backend
   pnpm dev
   ```

2. **Start Test Client**
   ```bash
   cd examples/clients/nextjs-ssr
   pnpm dev
   ```
   
   The client will automatically:
   - Fetch OpenID Configuration from `http://localhost:8080/.well-known/openid-configuration`
   - Configure all OAuth endpoints
   - Start on http://localhost:3000

3. **View Discovery Information (Optional)**
   - Navigate to http://localhost:3000/discovery
   - View OpenID Provider Configuration
   - View JSON Web Key Set (JWKS)

4. **Login Test**
   - Navigate to http://localhost:3000
   - Click "Sign In with OIDC" button
   - Authenticate on the backend login page (test-config-user@example.com / changemelater)
   - Automatically redirect to `/profile` page

5. **View Profile Page**
   - Check user information from ID Token
   - View Access Token, Refresh Token, and ID Token
   - View ID Token Payload (decoded JWT)
   - **NEW**: Test Token Introspection
     - Click "Introspect" button for Access Token to verify token status
     - Click "Introspect" button for Refresh Token (if available)
     - View token metadata: active status, scope, client_id, expiration, etc.

6. **Logout**
   - Click "Logout" button to delete tokens

## Authentication Flow

```
1. Application Startup
   ↓
2. Fetch OpenID Configuration (.well-known/openid-configuration)
   ↓
3. User clicks "Sign In with OIDC"
   ↓
4. Generate PKCE code_verifier, code_challenge, state, nonce
   ↓
5. Redirect to authorization endpoint
   (/oauth/authorize?client_id=...&redirect_uri=...&code_challenge=...)
   ↓
6. User authenticates on OIDC Provider
   ↓
7. Redirect to /api/callback with authorization code
   ↓
8. Exchange authorization code for tokens using code verifier
   (POST /oauth/token)
   ↓
9. Store tokens in httpOnly cookies
   ↓
10. Redirect to /profile page to display user information
```

## Test Scenarios

### Basic Authentication Flow
- ✅ Authorization Code Flow with PKCE
- ✅ State parameter verification (CSRF prevention)
- ✅ Nonce verification (ID Token replay attack prevention)
- ✅ Token exchange and storage

### Error Handling
- ✅ State mismatch error
- ✅ Missing parameters error
- ✅ Token exchange failure
- ✅ Provider authentication error

### Security Features
- ✅ Token storage using httpOnly cookies
- ✅ PKCE (Proof Key for Code Exchange)
- ✅ State parameter verification
- ✅ Nonce verification

## Tech Stack

- **Framework**: Next.js 16.1.1 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **JWT**: jose 6.x
- **Validation**: Zod 4.x

## Debugging

### Token Inspection
The profile page displays the following information:
- Access Token (raw)
- Refresh Token (raw)
- ID Token (raw)
- ID Token Payload (decoded)
- **Token Introspection Results** (RFC 7662)
  - Active status (true/false)
  - Scope information
  - Client ID
  - Subject (user ID)
  - Expiration time
  - Issued-at time

### Browser DevTools
- Check OAuth requests/responses in the Network tab
- View stored token cookies in Application > Cookies

## Troubleshooting

### "OIDC config not initialized, using fallback"

This warning during `pnpm build` is **normal**. The OIDC Discovery runs at runtime (when the server starts), not at build time. The application will use the fallback configuration during the build process.

### Discovery fails with network error

1. Ensure the OIDC provider is running at the URL specified in `OIDC_ISSUER`
2. Check that `/.well-known/openid-configuration` endpoint is accessible
3. Verify CORS settings if running on different domains
4. Check the retry settings in `.env.local`:
   - `OIDC_DISCOVERY_RETRY_ENABLED=true`
   - `OIDC_DISCOVERY_MAX_RETRIES=3`

### Endpoints are not updated

If you change the `OIDC_ISSUER`, restart the development server:
```bash
pnpm dev
```

The configuration is fetched on server startup and cached in memory.

## Standards Compliance

This implementation follows:

- [OpenID Connect Discovery 1.0](https://openid.net/specs/openid-connect-discovery-1_0.html)
- [RFC 6749 - OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc6749)
- [RFC 7636 - PKCE](https://datatracker.ietf.org/doc/html/rfc7636)
- [RFC 7662 - Token Introspection](https://datatracker.ietf.org/doc/html/rfc7662)
- [RFC 7009 - Token Revocation](https://datatracker.ietf.org/doc/html/rfc7009)

