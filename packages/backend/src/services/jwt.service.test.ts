import { decodeJwt, decodeProtectedHeader } from 'jose';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest';
import {
  JwtKeyEntity,
  JwtKeyStatus,
} from '#backend/entities/jwt-key.entity.js';
import type { ServiceContainer } from '#backend/services/container.js';
import type { JwtService } from '#backend/services/jwt.service.js';
import {
  CLI_TEST_CONFIG,
  createTestApp,
  createTestOAuthClient,
  createTestUser,
  MINIMAL_TEST_CONFIG,
  withMikroContext,
} from '#backend/test-utils/index.js';

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

    beforeAll(async () => {
      const server = await createTestApp({
        ...MINIMAL_TEST_CONFIG,
        server: {
          public_origin: 'https://auth.example.com',
        },
      });
      services = server.services;
      cleanup = server.cleanup;
    });

    afterAll(async () => {
      await cleanup();
    });

    test('should sign and verify access token', async () => {
      await withMikroContext(services, async () => {
        const token = await services.jwtService.signAccessToken({
          typ: 'access_token',
          sub: 'user-123',
          client_id: 'test-client',
          scope: 'openid email',
        });

        expect(typeof token).toBe('string');
        expect(token.split('.')).toHaveLength(3);

        const payload = await services.jwtService.verifyAccessToken(token);
        expect(payload.typ).toBe('access_token');
        expect(payload.sub).toBe('user-123');
        expect(payload.client_id).toBe('test-client');
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
          sub: 'user-456',
          client_id: 'test-client',
          scope: 'openid',
        });

        const payload = await services.jwtService.verifyRefreshToken(token);
        expect(payload.typ).toBe('refresh_token');
        expect(payload.sub).toBe('user-456');
        expect(payload.client_id).toBe('test-client');
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
          sub: 'user-123',
          client_id: 'test-client',
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
          sub: 'user-123',
          client_id: 'test-client',
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
          sub: 'user-123',
          client_id: 'test-client',
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

    test('should reject revoked access token', async () => {
      // Create real user and client for FK constraints
      const userSub = await createTestUser(services);
      const clientId = await createTestOAuthClient(services);

      await withMikroContext(services, async () => {
        const token = await services.jwtService.signAccessToken({
          typ: 'access_token',
          sub: userSub,
          client_id: 'test-client',
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
          sub: 'user-rotate',
          client_id: 'test-client',
          scope: 'openid',
        });

        // Rotate keys
        await services.jwtService.createNextKey();
        await services.jwtService.rotateKeys();

        // Token signed with now-previous key should still verify
        const payload = await services.jwtService.verifyAccessToken(token);
        expect(payload.sub).toBe('user-rotate');
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

  describe('validateBearerToken', () => {
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

    test('should validate a valid Bearer token end-to-end', async () => {
      await withMikroContext(services, async () => {
        const token = await services.jwtService.signAccessToken({
          typ: 'access_token',
          sub: 'user-e2e',
          client_id: 'test-client',
          scope: 'openid email',
        });

        const payload = await services.jwtService.validateBearerToken({
          headers: { authorization: `Bearer ${token}` },
        });

        expect(payload.sub).toBe('user-e2e');
        expect(payload.client_id).toBe('test-client');
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
