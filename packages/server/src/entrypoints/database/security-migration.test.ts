import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { BackgroundJobEntitySchema } from '../../entities/background-job.entity.js';
import { BrowserSessionEntitySchema } from '../../entities/browser-session.entity.js';
import { UserEntity } from '../../entities/user.entity.js';
import { encrypt } from '../../lib/crypto.js';
import { withMikroContext } from '../../test-utils/helpers.js';
import { securityProcessConfig } from '../../test-utils/security-process-config.js';
import { createTestApp } from '../../test-utils/setup.js';

test('authentication epoch migration rolls down and up and invalidates old authentication', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'issuary-migration-'));
  const server = await createTestApp(
    securityProcessConfig(join(directory, 'migration.sqlite')),
  );
  try {
    const before = await server.services.mikro.em
      .fork()
      .findOneOrFail(UserEntity, { sub: 'test-config-user' });
    const epoch = before.token_epoch;
    const sid = crypto.randomUUID();
    await server.services.mikro.em.fork().insert(BrowserSessionEntitySchema, {
      id: sid,
      revision: 0,
      expires_at: new Date(Date.now() + 60000),
      data: {
        user: {
          sub: before.sub,
          authenticated_at: Math.floor(Date.now() / 1000),
        },
        security: { grants: { [before.sub]: before.token_epoch } },
      },
    });
    const cookie = await encrypt(
      JSON.stringify({ sid, kind: 'session' }),
      server.services.config.security.session_secret,
    );
    expect(
      (
        await server.app.request('/api/user/oauth-accounts', {
          headers: { cookie: `session=${cookie}` },
        })
      ).status,
    ).toBe(200);
    await withMikroContext(server.services, async () => {
      const mikro = server.services.mikro;
      await mikro.emailVerification.generateToken({
        userSub: before.sub,
        userEpoch: epoch,
      });
      await mikro.passwordReset.generateToken({
        userSub: before.sub,
        userEpoch: epoch,
      });
      const link = mikro.userOAuth.create({
        user: before.sub,
        provider_name: 'google',
        provider_user_id: 'migration-link',
        access_token: 'retained-provider-token',
        refresh_token: '',
      });
      const passkey = mikro.userPasskey.create({
        user: before.sub,
        credential_id: 'migration-passkey',
        public_key: 'retained-public-key',
        counter: 7,
        device_type: 'singleDevice',
        backed_up: false,
      });
      const totp = mikro.userTotp.create({
        user: before.sub,
        secret: 'retained-totp-secret',
        verified: true,
        recovery_confirmed: true,
      });
      await mikro.em.persist([link, passkey, totp]).flush();
      await mikro.pendingOAuthRegistration.createPendingRegistration({
        providerId: 'google',
        accessToken: 'retired-provider-token',
        tokenType: 'Bearer',
        userInfo: {
          id: 'unfinished',
          email: before.email,
          email_verified: true,
        },
        expiresAt: new Date(Date.now() + 60000),
      });
      await mikro.em.insert(BackgroundJobEntitySchema, {
        id: 'migration-mail',
        created_at: new Date(),
        updated_at: new Date(),
        jobId: 'security.mail',
        status: 'running',
        payload: 'private-old-payload',
        availableAt: new Date(),
        lockedBy: 'old-worker',
        lockedUntil: new Date(Date.now() + 60000),
        attemptCount: 1,
        maxAttempts: 3,
      });
    });
    await server.services.mikro.orm.migrator.down();
    await server.services.mikro.orm.migrator.up();
    const after = await server.services.mikro.em
      .fork()
      .findOneOrFail(UserEntity, { sub: 'test-config-user' });
    expect(after.token_epoch).not.toBe(epoch);
    expect(after.sessions_invalidated_at).not.toBeNull();
    expect(after.security_revision).toBe(before.security_revision);
    expect(
      (
        await server.app.request('/api/user/oauth-accounts', {
          headers: { cookie: `session=${cookie}` },
        })
      ).status,
    ).toBe(401);
    expect(
      await server.services.mikro.em
        .fork()
        .count(BrowserSessionEntitySchema, { id: sid }),
    ).toBe(0);
    await withMikroContext(server.services, async () => {
      const mikro = server.services.mikro;
      expect(await mikro.emailVerification.count({})).toBe(0);
      expect(await mikro.passwordReset.count({})).toBe(0);
      expect(await mikro.pendingOAuthRegistration.count({})).toBe(0);
      expect(
        await mikro.userOAuth.count({
          user: before.sub,
          provider_user_id: 'migration-link',
        }),
      ).toBe(1);
      expect(
        await mikro.userPasskey.count({
          user: before.sub,
          credential_id: 'migration-passkey',
          counter: 7,
        }),
      ).toBe(1);
      expect(
        await mikro.userTotp.count({
          user: before.sub,
          secret: 'retained-totp-secret',
          verified: true,
        }),
      ).toBe(1);
      const mail = await mikro.em.findOneOrFail(BackgroundJobEntitySchema, {
        id: 'migration-mail',
      });
      expect(mail).toMatchObject({
        status: 'failed',
        payload: 'null',
        lockedBy: null,
        lockedUntil: null,
      });
    });
    // Existing baseline drift (comments, unrelated indexes) is outside this migration.
    expect(
      await server.services.mikro.orm.schema.getUpdateSchemaSQL(),
    ).not.toMatch(
      /oauth_grant|security_revision|grant_id|user_epoch|token_epoch|consumed_at/,
    );
  } finally {
    await server.cleanup();
    await rm(directory, { recursive: true, force: true });
  }
}, 30000);
