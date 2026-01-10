# OIDC Test Client

A Next.js-based client application for testing OpenID Connect (OIDC) Providers.

## Features

- ✅ **Authorization Code Flow with PKCE** - Secure OAuth 2.0 authentication flow
- ✅ **ID Token Verification & Decoding** - JWT-based user information verification
- ✅ **Token Storage & Management** - Secure token storage using httpOnly cookies
- ✅ **User Information Display** - Decode and display ID Token claims
- ✅ **Logout Functionality** - Token deletion and session termination

## Project Structure

```
client-test/
├── app/
│   ├── page.tsx                          # Main page (login button)
│   ├── callback/page.tsx                 # OAuth callback handler
│   ├── profile/page.tsx                  # Profile page after authentication
│   └── api/auth/
│       ├── login/route.ts                # OIDC authentication start
│       └── logout/route.ts               # Logout handler
├── lib/
│   ├── oidc-config.ts                    # OIDC configuration
│   ├── oidc-client.ts                    # OIDC client utilities
│   ├── pkce.ts                           # PKCE utilities
│   └── token-storage.ts                  # Token storage/management
└── types/
    └── oidc.ts                           # TypeScript type definitions
```

## Configuration

### OIDC Provider Configuration

Configure your OIDC Provider information in `lib/oidc-config.ts`:

```typescript
export const oidcConfig: OIDCConfig = {
  issuer: 'http://localhost:8080',
  authorization_endpoint: 'http://localhost:8080/application/oauth/authorize',
  token_endpoint: 'http://localhost:8080/application/oauth/token',
  userinfo_endpoint: 'http://localhost:8080/application/oauth/userinfo',
  
  client_id: 'sdlk3n3dkj2',
  client_secret: 'sdlk3n3dkj2',
  redirect_uri: 'http://localhost:3000/callback',
  
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
   cd packages/client-test
   pnpm dev
   ```

3. **Login Test**
   - Navigate to http://localhost:3000
   - Click "Sign In with OIDC" button
   - Authenticate on the backend login page (test-config-user@example.com / changemelater)
   - Automatically redirect to `/profile` page

4. **View Profile Page**
   - Check user information from ID Token
   - View Access Token, Refresh Token, and ID Token
   - View ID Token Payload (decoded JWT)

5. **Logout**
   - Click "Logout" button to delete tokens

## Authentication Flow

```
1. User clicks "Sign In with OIDC"
   ↓
2. Generate PKCE code_verifier, code_challenge, state, nonce
   ↓
3. Redirect to authorization endpoint
   (/application/oauth/authorize?client_id=...&redirect_uri=...&code_challenge=...)
   ↓
4. User authenticates on OIDC Provider
   ↓
5. Redirect to /callback with authorization code
   ↓
6. Exchange authorization code for tokens using code verifier
   (POST /application/oauth/token)
   ↓
7. Store tokens in httpOnly cookies
   ↓
8. Redirect to /profile page to display user information
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

### Browser DevTools
- Check OAuth requests/responses in the Network tab
- View stored token cookies in Application > Cookies
