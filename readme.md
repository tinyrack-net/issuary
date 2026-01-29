# tinyauth

A lightweight, self-hosted OpenID Connect (OIDC) Provider.

## Features

- **OIDC/OAuth2 Compliant** - Authorization Code Flow with PKCE support
- **Multiple Auth Methods** - Password, Passkey/WebAuthn, Social Login (GitHub, Google, Apple, Generic OAuth)
- **Two-Factor Authentication** - TOTP and Passkey as 2FA
- **Multi-language** - English, Korean, Japanese
- **Customizable UI** - Themes, branding, background images, terms of service
- **Database Support** - PostgreSQL, SQLite
- **Docker Ready** - Production-ready container with health checks

## Quick Start

```bash
docker run -p 8080:8080 -v ./config.yaml:/opt/config.yaml tinyrack/tinyauth
```

Visit `http://localhost:8080/.well-known/openid-configuration` to verify the server is running.

## Configuration

All configuration is done via `config.yaml`:

```yaml
app:
  host: https://auth.example.com
  port: 8080
  cookie_secret: <your-secret>

database:
  type: sqlite
  path: data.db

basic_authentication_methods:
  password:
    enabled: true
  passkey:
    enabled: true
```

See [documentation](https://tinyauth.dev) for full configuration options.

## Development

```bash
pnpm install
pnpm dev
```

## License

[MIT](LICENSE)
