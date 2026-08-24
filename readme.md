<div align="center">

# Issuary

**A lightweight, self-hosted OpenID Connect provider for modern applications.**

[![CI](https://github.com/tinyrack-net/issuary/actions/workflows/ci.yml/badge.svg)](https://github.com/tinyrack-net/issuary/actions/workflows/ci.yml)
[![npm server](https://img.shields.io/npm/v/@tinyrack/issuary-server?label=server)](https://www.npmjs.com/package/@tinyrack/issuary-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D24-brightgreen)](https://nodejs.org/)

[Documentation](https://issuary.tinyrack.net/en/) · [Configuration](https://issuary.tinyrack.net/en/configuration/overview/) · [한국어](https://issuary.tinyrack.net/ko/)

</div>

---

Issuary is a self-hosted OpenID Connect (OIDC) provider that gives your apps a standards-based login system without bringing in a full identity platform.

It supports OAuth2/OIDC authorization code flows, PKCE, password login, passkeys, TOTP, social login, and a customizable multilingual frontend. Run it as a standalone server, ship it with Docker, or embed the server package in your own Node.js application.

## Features

- **OIDC/OAuth2 provider** with authorization code flow, PKCE, discovery, token, userinfo, introspection, revocation, RP-initiated logout, client credentials, and device authorization endpoints
- **Multiple sign-in methods** including password, passkeys/WebAuthn, GitHub, Google, Apple, and generic OAuth/OIDC providers
- **Two-factor authentication** with TOTP and passkey-based second factors
- **Config-driven deployment** through a single YAML file
- **Customizable frontend** with themes, branding, background images, language selection, and terms flows
- **Database support** for SQLite and PostgreSQL
- **Standalone or embedded usage** through Docker or `@tinyrack/issuary-server`

## Installation

### Docker

```bash
docker run --rm \
  -p 8080:8080 \
  -v ./config.yaml:/opt/config.yaml \
  ghcr.io/tinyrack-net/issuary:latest
```

### Server package

Use the server package when you want to embed Issuary in your own Node.js runtime.

```bash
npm install @tinyrack/issuary-server
```

## Quick Start

Create a minimal `config.yaml`:

```yaml
app:
  host: http://localhost:8080
  port: 8080

security:
  session_secret: change-me-session-secret
  hash_secret: change-me-hash-secret

database:
  type: sqlite
  path: ./data.db

basic_authentication_methods:
  password:
    enabled: true
  passkey:
    enabled: true
```

Start Issuary:

```bash
docker run --rm \
  -p 8080:8080 \
  -v ./config.yaml:/opt/config.yaml \
  ghcr.io/tinyrack-net/issuary:latest
```

Verify the OIDC discovery endpoint:

```bash
curl http://localhost:8080/.well-known/openid-configuration
```

OAuth/OIDC error responses from OAuth endpoints include the standard `error` and `error_description` fields for client compatibility. Issuary also preserves its internal `code` and `message` fields for existing API consumers.

Issuary only advertises implemented provider capabilities in discovery metadata. Register `client_credentials` only for confidential clients with a `client_secret`, and register `urn:ietf:params:oauth:grant-type:device_code` only for clients that should use the device authorization flow.

## Examples

- `examples/clients/nextjs-ssr` — Next.js OIDC client with server-side token handling
- `examples/clients/react-spa` — React SPA using authorization code flow with PKCE
- `examples/servers/node-hono-sqlite` — Hono + SQLite deployment using `@tinyrack/issuary-server` and the bundled frontend

## Documentation

For configuration guides, client integration examples, deployment notes, and the API reference, visit the **[Issuary documentation site](https://issuary.tinyrack.net/en/)**.

## License

[MIT](LICENSE)
