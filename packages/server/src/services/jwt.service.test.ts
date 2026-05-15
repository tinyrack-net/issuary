import { decodeJwt, decodeProtectedHeader, importPKCS8, SignJWT } from 'jose';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';
import { JwtKeyEntity, JwtKeyStatus } from '../entities/jwt-key.entity.ts';
import {
  CLI_TEST_CONFIG,
  createTestApp,
  createTestOAuthClient,
  createTestUser,
  MINIMAL_TEST_CONFIG,
  withMikroContext,
} from '../test-utils/index.ts';
import type { ServiceContainer } from './container.ts';
import type { JwtService } from './jwt.service.ts';

describe('JwtService', () => {
  describe('extractBearerToken', () => {
    let jwtService: JwtService;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      const server = await createTestApp(MINIMAL_TEST_CONFIG);
      jwtService = server.services.jwtService;
      cleanup = server.cleanup;
    });

    afterAll(async () => {
      await cleanup();
    });

    test('should extract valid Bearer token', () => {
      const token = jwtService.extractBearerToken({
        headers: { authorization: 'Bearer abc123' },
      });
      expect(token).toBe('abc123');
    });

    test('should throw when Authorization header is missing', () => {
      expect(() => jwtService.extractBearerToken({ headers: {} })).toThrow();
    });

    test('should throw for Basic auth scheme', () => {
      expect(() =>
        jwtService.extractBearerToken({
          headers: { authorization: 'Basic abc123' },
        }),
      ).toThrow();
    });

    test('should throw when token part is empty', () => {
      // "Bearer " splits into ["Bearer", ""] — parts[1] is empty string
      expect(() =>
        jwtService.extractBearerToken({
          headers: { authorization: 'Bearer ' },
        }),
      ).toThrow();
    });

    test('should throw for malformed header with extra spaces', () => {
      // "Bearer  token" splits into 3 parts
      expect(() =>
        jwtService.extractBearerToken({
          headers: { authorization: 'Bearer  token' },
        }),
      ).toThrow();
    });

    test('should throw for header with no space', () => {
      expect(() =>
        jwtService.extractBearerToken({
          headers: { authorization: 'Bearertoken' },
        }),
      ).toThrow();
    });
  });

  describe('generateKeyPair', () => {
    let jwtService: JwtService;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      const server = await createTestApp(MINIMAL_TEST_CONFIG);
      jwtService = server.services.jwtService;
      cleanup = server.cleanup;
    });

    afterAll(async () => {
      await cleanup();
    });

    test('should generate a valid key pair', async () => {
      const keyPair = await jwtService.generateKeyPair();
      expect(keyPair.kid).toMatch(/^key-[a-z0-9]+-[a-z0-9]+$/);
      expect(keyPair.algorithm).toBe('RS256');
      expect(keyPair.privateKey).toContain('-----BEGIN PRIVATE KEY-----');
      expect(keyPair.publicKey).toContain('-----BEGIN PUBLIC KEY-----');
    });

    test('should generate unique kid on each call', async () => {
      const a = await jwtService.generateKeyPair();
      const b = await jwtService.generateKeyPair();
      expect(a.kid).not.toBe(b.kid);
    });
  });

  describe('ensureActiveKey and getActiveKey', () => {
    let services: ServiceContainer;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      const server = await createTestApp(CLI_TEST_CONFIG);
      services = server.services;
      cleanup = server.cleanup;
    });

    afterAll(async () => {
      await cleanup();
    });

    beforeEach(async () => {
      // Clear all JWT keys before each test
      await withMikroContext(services, async () => {
        const em = services.mikro.em.fork();
        await em.nativeDelete(JwtKeyEntity, {});
      });
      services.jwtService.clearActiveKeyCache();
    });

    test('should auto-create active key when none exists', async () => {
      await withMikroContext(services, async () => {
        const key = await services.jwtService.getActiveKey();
        expect(key).toBeDefined();
        expect(key.status).toBe(JwtKeyStatus.ACTIVE);
        expect(key.kid).toBeTruthy();
      });
    });

    test('should return cached key on subsequent calls', async () => {
      await withMikroContext(services, async () => {
        const first = await services.jwtService.getActiveKey();
        const second = await services.jwtService.getActiveKey();
        expect(first.kid).toBe(second.kid);
      });
    });

    test('should promote next key when no active key exists', async () => {
      await withMikroContext(services, async () => {
        // Create a "next" key
        const keyPair = await services.jwtService.generateKeyPair();
        const nextKey = services.mikro.jwtKey.create({
          kid: keyPair.kid,
          private_key: keyPair.privateKey,
          public_key: keyPair.publicKey,
          algorithm: keyPair.algorithm,
          status: JwtKeyStatus.NEXT,
          expires_at: new Date(Date.now() + 86400000),
        });
        await services.mikro.em.persist(nextKey).flush();

        // ensureActiveKey should promote it
        const active = await services.jwtService.ensureActiveKey();
        expect(active.kid).toBe(keyPair.kid);
        expect(active.status).toBe(JwtKeyStatus.ACTIVE);
      });
    });

    test('should refresh cache after TTL expires', async () => {
      vi.useFakeTimers();
      try {
        await withMikroContext(services, async () => {
          const first = await services.jwtService.getActiveKey();

          // Advance time past the 1-minute cache TTL
          vi.advanceTimersByTime(61_000);

          // Next call should hit the DB again (but returns same key since no rotation)
          const second = await services.jwtService.getActiveKey();
          expect(second.kid).toBe(first.kid);
        });
      } finally {
        vi.useRealTimers();
      }
    });

    test('should clear cache with clearActiveKeyCache', async () => {
      await withMikroContext(services, async () => {
        await services.jwtService.getActiveKey();
        services.jwtService.clearActiveKeyCache();
        // Should not throw — just fetches from DB again
        const key = await services.jwtService.getActiveKey();
        expect(key).toBeDefined();
      });
    });
  });

  describe('token signing and verification', () => {
    let services: ServiceContainer;
    let cleanup: () => Promise<void>;
    let tokenSubject: string;
    const tokenClientId = 'jwt-service-token-client';

    beforeAll(async () => {
      const server = await createTestApp({
        ...MINIMAL_TEST_CONFIG,
        server: {
          public_origin: 'https://auth.example.com',
        },
      });
      services = server.services;
      cleanup = server.cleanup;
      tokenSubject = await createTestUser(services);
      await createTestOAuthClient(services, { clientId: tokenClientId });
    });

    afterAll(async () => {
      await cleanup();
    });

    test('should sign and verify access token', async () => {
      await withMikroContext(services, async () => {
        const token = await services.jwtService.signAccessToken({
          typ: 'access_token',
          sub: tokenSubject,
          client_id: tokenClientId,
          scope: 'openid email',
        });

        expect(typeof token).toBe('string');
        expect(token.split('.')).toHaveLength(3);

        const payload = await services.jwtService.verifyAccessToken(token);
        expect(payload.typ).toBe('access_token');
        expect(payload.sub).toBe(tokenSubject);
        expect(payload.client_id).toBe(tokenClientId);
        expect(payload.scope).toBe('openid email');
        expect(payload.iss).toBe('https://auth.example.com');
        expect(payload.jti).toBeDefined();
        expect(payload.iat).toBeDefined();
        expect(payload.exp).toBeDefined();
      });
    });

    test('should sign and verify refresh token', async () => {
      await withMikroContext(services, async () => {
        const token = await services.jwtService.signRefreshToken({
          typ: 'refresh_token',
          sub: tokenSubject,
          client_id: tokenClientId,
          scope: 'openid',
        });

        const payload = await services.jwtService.verifyRefreshToken(token);
        expect(payload.typ).toBe('refresh_token');
        expect(payload.sub).toBe(tokenSubject);
        expect(payload.client_id).toBe(tokenClientId);
      });
    });

    test('should sign ID token with correct claims', async () => {
      await withMikroContext(services, async () => {
        const token = await services.jwtService.signIdToken({
          sub: 'user-789',
          aud: 'test-client',
          nonce: 'test-nonce',
          email: 'user@example.com',
          email_verified: true,
          name: 'Test User',
          auth_time: 1700000000,
          at_hash: 'test-at-hash',
        });

        const payload = decodeJwt(token);
        expect(payload.sub).toBe('user-789');
        expect(payload.aud).toBe('test-client');
        expect(payload['nonce']).toBe('test-nonce');
        expect(payload['email']).toBe('user@example.com');
        expect(payload['email_verified']).toBe(true);
        expect(payload['name']).toBe('Test User');
        expect(payload['auth_time']).toBe(1700000000);
        expect(payload['at_hash']).toBe('test-at-hash');
        expect(payload.iss).toBe('https://auth.example.com');
      });
    });

    test('should omit optional ID token claims when not provided', async () => {
      await withMikroContext(services, async () => {
        const token = await services.jwtService.signIdToken({
          sub: 'user-789',
          aud: 'test-client',
        });

        const payload = decodeJwt(token);
        expect(payload.sub).toBe('user-789');
        expect(payload['nonce']).toBeUndefined();
        expect(payload['email']).toBeUndefined();
        expect(payload['name']).toBeUndefined();
        expect(payload['auth_time']).toBeUndefined();
        expect(payload['at_hash']).toBeUndefined();
      });
    });

    test('should set correct JWT headers', async () => {
      await withMikroContext(services, async () => {
        const token = await services.jwtService.signAccessToken({
          typ: 'access_token',
          sub: tokenSubject,
          client_id: tokenClientId,
          scope: 'openid',
        });

        const header = decodeProtectedHeader(token);
        expect(header.alg).toBe('RS256');
        expect(header.typ).toBe('JWT');
        expect(header.kid).toBeDefined();
      });
    });

    test('should reject access token verified as refresh token', async () => {
      await withMikroContext(services, async () => {
        const token = await services.jwtService.signAccessToken({
          typ: 'access_token',
          sub: tokenSubject,
          client_id: tokenClientId,
          scope: 'openid',
        });

        await expect(
          services.jwtService.verifyRefreshToken(token),
        ).rejects.toThrow();
      });
    });

    test('should reject refresh token verified as access token', async () => {
      await withMikroContext(services, async () => {
        const token = await services.jwtService.signRefreshToken({
          typ: 'refresh_token',
          sub: tokenSubject,
          client_id: tokenClientId,
          scope: 'openid',
        });

        await expect(
          services.jwtService.verifyAccessToken(token),
        ).rejects.toThrow();
      });
    });

    test('should reject garbage token', async () => {
      await withMikroContext(services, async () => {
        await expect(
          services.jwtService.verifyAccessToken('not-a-jwt'),
        ).rejects.toThrow();
      });
    });

    test('should reject access token with wrong issuer signed by active key', async () => {
      await withMikroContext(services, async () => {
        const activeKey = await services.jwtService.getActiveKey();
        const privateKey = await importPKCS8(activeKey.private_key, 'RS256');
        const token = await new SignJWT({
          typ: 'access_token',
          sub: tokenSubject,
          client_id: tokenClientId,
          scope: 'openid',
        })
          .setProtectedHeader({ alg: 'RS256', typ: 'JWT', kid: activeKey.kid })
          .setIssuedAt()
          .setExpirationTime('5m')
          .setIssuer('https://wrong-issuer.example.com')
          .sign(privateKey);

        await expect(
          services.jwtService.verifyAccessToken(token),
        ).rejects.toThrow();
      });
    });

    test('should reject revoked access token', async () => {
      // Create real user and client for FK constraints
      const userSub = await createTestUser(services);
      const revokedTokenClientId = `revoked-token-client-${crypto.randomUUID()}`;
      const clientId = await createTestOAuthClient(services, {
        clientId: revokedTokenClientId,
      });

      await withMikroContext(services, async () => {
        const token = await services.jwtService.signAccessToken({
          typ: 'access_token',
          sub: userSub,
          client_id: revokedTokenClientId,
          scope: 'openid',
        });

        // Decode to get jti
        const decoded = decodeJwt(token);
        const jti = decoded.jti;
        if (!jti) {
          throw new Error('Expected jti to be defined');
        }

        // Revoke the token using real entity IDs
        await services.mikro.revokedToken.revokeToken({
          jti,
          token_type: 'access_token',
          clientId,
          userSub,
          expires_at: new Date(Date.now() + 3600000),
        });

        await expect(
          services.jwtService.verifyAccessToken(token),
        ).rejects.toThrow();
      });
    });
  });

  describe('decodeToken', () => {
    let services: ServiceContainer;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      const server = await createTestApp(MINIMAL_TEST_CONFIG);
      services = server.services;
      cleanup = server.cleanup;
    });

    afterAll(async () => {
      await cleanup();
    });

    test('should decode a valid JWT without verification', async () => {
      await withMikroContext(services, async () => {
        const token = await services.jwtService.signAccessToken({
          typ: 'access_token',
          sub: 'user-123',
          client_id: 'test-client',
          scope: 'openid',
        });

        const decoded = services.jwtService.decodeToken(token);
        expect(decoded).not.toBeNull();
        expect(decoded?.sub).toBe('user-123');
      });
    });

    test('should return null for invalid token', () => {
      const decoded = services.jwtService.decodeToken('not-a-jwt');
      expect(decoded).toBeNull();
    });

    test('should return null for empty string', () => {
      const decoded = services.jwtService.decodeToken('');
      expect(decoded).toBeNull();
    });
  });

  describe('active subject and client policy', () => {
    let services: ServiceContainer;
    let cleanup: () => Promise<void>;
    const activePolicyClientId = 'jwt-active-policy-client';

    beforeAll(async () => {
      const server = await createTestApp(MINIMAL_TEST_CONFIG);
      services = server.services;
      cleanup = server.cleanup;
      await createTestOAuthClient(services, { clientId: activePolicyClientId });
    });

    afterAll(async () => {
      await cleanup();
    });

    test('should reject access token when subject no longer exists', async () => {
      await withMikroContext(services, async () => {
        const token = await services.jwtService.signAccessToken({
          typ: 'access_token',
          sub: 'missing-token-subject',
          client_id: activePolicyClientId,
          scope: 'openid',
        });

        await expect(
          services.jwtService.verifyAccessToken(token),
        ).rejects.toThrow();
      });
    });

    test('should reject refresh token when client no longer exists', async () => {
      const userSub = await createTestUser(services);
      await withMikroContext(services, async () => {
        const token = await services.jwtService.signRefreshToken({
          typ: 'refresh_token',
          sub: userSub,
          client_id: 'missing-token-client',
          scope: 'openid',
        });

        await expect(
          services.jwtService.verifyRefreshToken(token),
        ).rejects.toThrow();
      });
    });
  });

  describe('convertToJWK and getJWKS', () => {
    let services: ServiceContainer;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      const server = await createTestApp(MINIMAL_TEST_CONFIG);
      services = server.services;
      cleanup = server.cleanup;
    });

    afterAll(async () => {
      await cleanup();
    });

    test('should return JWK with correct RSA fields', async () => {
      await withMikroContext(services, async () => {
        const activeKey = await services.jwtService.getActiveKey();
        const jwk = await services.jwtService.convertToJWK(activeKey);

        expect(jwk.kty).toBe('RSA');
        expect(jwk.use).toBe('sig');
        expect(jwk.kid).toBe(activeKey.kid);
        expect(jwk.alg).toBe('RS256');
        expect(jwk.n).toBeDefined();
        expect(jwk.e).toBeDefined();
      });
    });

    test('should return JWKS with at least one key', async () => {
      await withMikroContext(services, async () => {
        const jwks = await services.jwtService.getJWKS();
        expect(jwks.keys).toBeDefined();
        expect(jwks.keys.length).toBeGreaterThanOrEqual(1);

        const firstKey = jwks.keys[0];
        expect(firstKey).toBeDefined();
        expect(firstKey?.kty).toBe('RSA');
        expect(firstKey?.use).toBe('sig');
      });
    });
  });

  describe('key rotation', () => {
    let services: ServiceContainer;
    let cleanup: () => Promise<void>;
    let tokenSubject: string;
    const tokenClientId = 'jwt-key-rotation-client';

    beforeAll(async () => {
      const server = await createTestApp(CLI_TEST_CONFIG);
      services = server.services;
      cleanup = server.cleanup;
      tokenSubject = await createTestUser(services);
      await createTestOAuthClient(services, { clientId: tokenClientId });
    });

    afterAll(async () => {
      await cleanup();
    });

    beforeEach(async () => {
      await withMikroContext(services, async () => {
        const em = services.mikro.em.fork();
        await em.nativeDelete(JwtKeyEntity, {});
      });
      services.jwtService.clearActiveKeyCache();
    });

    test('should rotate active key to previous and promote next', async () => {
      await withMikroContext(services, async () => {
        // Create initial active key
        await services.jwtService.createAndActivateKey();
        const originalActive = await services.jwtService.getActiveKey();
        const originalKid = originalActive.kid;

        // Create next key
        await services.jwtService.createNextKey();

        // Rotate
        const newActive = await services.jwtService.rotateKeys();
        expect(newActive.kid).not.toBe(originalKid);
        expect(newActive.status).toBe(JwtKeyStatus.ACTIVE);

        // Original key should now be PREVIOUS
        const em = services.mikro.em.fork();
        const oldKey = await em.findOne(JwtKeyEntity, { kid: originalKid });
        expect(oldKey?.status).toBe(JwtKeyStatus.PREVIOUS);
      });
    });

    test('should verify token signed with previous key after rotation', async () => {
      await withMikroContext(services, async () => {
        // Sign a token with current key
        const token = await services.jwtService.signAccessToken({
          typ: 'access_token',
          sub: tokenSubject,
          client_id: tokenClientId,
          scope: 'openid',
        });

        // Rotate keys
        await services.jwtService.createNextKey();
        await services.jwtService.rotateKeys();

        // Token signed with now-previous key should still verify
        const payload = await services.jwtService.verifyAccessToken(token);
        expect(payload.sub).toBe(tokenSubject);
      });
    });

    test('should create new next key when rotating without one', async () => {
      await withMikroContext(services, async () => {
        await services.jwtService.createAndActivateKey();

        // Rotate without pre-creating a next key
        const newActive = await services.jwtService.rotateKeys();
        expect(newActive.status).toBe(JwtKeyStatus.ACTIVE);
        expect(newActive.kid).toBeDefined();
      });
    });
  });

  describe('JWT/JWKS edge security policy', () => {
    let services: ServiceContainer;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      const server = await createTestApp(CLI_TEST_CONFIG);
      services = server.services;
      cleanup = server.cleanup;
    });

    afterAll(async () => {
      await cleanup();
    });

    beforeEach(async () => {
      await withMikroContext(services, async () => {
        const em = services.mikro.em.fork();
        await em.nativeDelete(JwtKeyEntity, {});
      });
      services.jwtService.clearActiveKeyCache();
    });

    test('should exclude retired keys from JWKS', async () => {
      await withMikroContext(services, async () => {
        const retiredKey = await services.jwtService.createAndActivateKey();
        await services.jwtService.createNextKey();
        await services.jwtService.rotateKeys();

        retiredKey.status = JwtKeyStatus.RETIRED;
        retiredKey.retired_at = new Date();
        await services.mikro.em.flush();

        const jwks = await services.jwtService.getJWKS();
        const jwksKids = jwks.keys.map((key) => key.kid);

        expect(jwksKids).not.toContain(retiredKey.kid);
      });
    });

    test('should reject token signed with a retired key', async () => {
      await withMikroContext(services, async () => {
        const retiredKey = await services.jwtService.createAndActivateKey();
        const privateKey = await importPKCS8(retiredKey.private_key, 'RS256');
        const token = await new SignJWT({
          typ: 'access_token',
          sub: 'retired-key-user',
          client_id: 'test-client',
          scope: 'openid',
        })
          .setProtectedHeader({ alg: 'RS256', typ: 'JWT', kid: retiredKey.kid })
          .setIssuedAt()
          .setExpirationTime('5m')
          .sign(privateKey);

        retiredKey.status = JwtKeyStatus.RETIRED;
        retiredKey.retired_at = new Date();
        await services.mikro.em.flush();
        services.jwtService.clearActiveKeyCache();

        await expect(
          services.jwtService.verifyAccessToken(token),
        ).rejects.toThrow();
      });
    });

    test('should reject signed token with missing kid', async () => {
      await withMikroContext(services, async () => {
        const activeKey = await services.jwtService.createAndActivateKey();
        const privateKey = await importPKCS8(activeKey.private_key, 'RS256');
        const token = await new SignJWT({
          typ: 'access_token',
          sub: 'missing-kid-user',
          client_id: 'test-client',
          scope: 'openid',
        })
          .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
          .setIssuedAt()
          .setExpirationTime('5m')
          .sign(privateKey);

        await expect(
          services.jwtService.verifyAccessToken(token),
        ).rejects.toThrow();
      });
    });

    test('should reject signed token with unknown kid instead of falling back to other keys', async () => {
      await withMikroContext(services, async () => {
        const activeKey = await services.jwtService.createAndActivateKey();
        const privateKey = await importPKCS8(activeKey.private_key, 'RS256');
        const token = await new SignJWT({
          typ: 'access_token',
          sub: 'unknown-kid-user',
          client_id: 'test-client',
          scope: 'openid',
        })
          .setProtectedHeader({ alg: 'RS256', typ: 'JWT', kid: 'unknown-kid' })
          .setIssuedAt()
          .setExpirationTime('5m')
          .sign(privateKey);

        await expect(
          services.jwtService.verifyAccessToken(token),
        ).rejects.toThrow();
      });
    });

    test('should reject alg none token', async () => {
      await withMikroContext(services, async () => {
        const activeKey = await services.jwtService.createAndActivateKey();
        const header = Buffer.from(
          JSON.stringify({ alg: 'none', typ: 'JWT', kid: activeKey.kid }),
        ).toString('base64url');
        const payload = Buffer.from(
          JSON.stringify({
            typ: 'access_token',
            sub: 'alg-none-user',
            client_id: 'test-client',
            scope: 'openid',
          }),
        ).toString('base64url');
        const token = `${header}.${payload}.`;

        await expect(
          services.jwtService.verifyAccessToken(token),
        ).rejects.toThrow();
      });
    });

    test('should reject HS256 token with an RSA key kid', async () => {
      await withMikroContext(services, async () => {
        const activeKey = await services.jwtService.createAndActivateKey();
        const secret = crypto.getRandomValues(new Uint8Array(32));
        const token = await new SignJWT({
          typ: 'access_token',
          sub: 'hs256-user',
          client_id: 'test-client',
          scope: 'openid',
        })
          .setProtectedHeader({ alg: 'HS256', typ: 'JWT', kid: activeKey.kid })
          .setIssuedAt()
          .setExpirationTime('5m')
          .sign(secret);

        await expect(
          services.jwtService.verifyAccessToken(token),
        ).rejects.toThrow();
      });
    });

    test('should not create duplicate active keys under concurrent initialization', async () => {
      await withMikroContext(services, async () => {
        const keys = await Promise.all([
          services.jwtService.getActiveKey(),
          services.jwtService.getActiveKey(),
          services.jwtService.getActiveKey(),
          services.jwtService.getActiveKey(),
        ]);
        const uniqueKids = new Set(keys.map((key) => key.kid));
        const activeKeys = await services.mikro.jwtKey.find({
          status: JwtKeyStatus.ACTIVE,
        });

        expect(uniqueKids.size).toBe(1);
        expect(activeKeys).toHaveLength(1);
      });
    });
  });

  describe('validateBearerToken', () => {
    let services: ServiceContainer;
    let cleanup: () => Promise<void>;
    let tokenSubject: string;
    const tokenClientId = 'jwt-bearer-token-client';

    beforeAll(async () => {
      const server = await createTestApp(MINIMAL_TEST_CONFIG);
      services = server.services;
      cleanup = server.cleanup;
      tokenSubject = await createTestUser(services);
      await createTestOAuthClient(services, { clientId: tokenClientId });
    });

    afterAll(async () => {
      await cleanup();
    });

    test('should validate a valid Bearer token end-to-end', async () => {
      await withMikroContext(services, async () => {
        const token = await services.jwtService.signAccessToken({
          typ: 'access_token',
          sub: tokenSubject,
          client_id: tokenClientId,
          scope: 'openid email',
        });

        const payload = await services.jwtService.validateBearerToken({
          headers: { authorization: `Bearer ${token}` },
        });

        expect(payload.sub).toBe(tokenSubject);
        expect(payload.client_id).toBe(tokenClientId);
        expect(payload.scope).toBe('openid email');
      });
    });

    test('should throw for missing Authorization header', async () => {
      await expect(
        services.jwtService.validateBearerToken({ headers: {} }),
      ).rejects.toThrow();
    });

    test('should throw for invalid token', async () => {
      await withMikroContext(services, async () => {
        await expect(
          services.jwtService.validateBearerToken({
            headers: { authorization: 'Bearer invalid-token' },
          }),
        ).rejects.toThrow();
      });
    });
  });
});
