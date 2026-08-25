import { OAuthClientEntitySchema } from '../entities/oauth-client.entity.ts';
import { OAuthCodeEntitySchema } from '../entities/oauth-code.entity.ts';
import { OAuthDeviceCodeEntitySchema } from '../entities/oauth-device-code.entity.ts';
import { UserEntity } from '../entities/user.entity.ts';
import { UserTotpRecoveryCodeEntitySchema } from '../entities/user-totp-recovery-code.entity.ts';
import type { IssuaryRuntimeConfig } from '../lib/config/index.ts';
import type { Logger } from '../lib/logger.ts';
import type { MikroService } from './mikro.service.ts';

const LEGACY_HASH_PATTERN = '%$v=1$%';
const RETIRED_CLIENT_SECRET_HASH = 'retired-legacy-v1-client-secret';

export interface LegacyCredentialCounts {
  passwords: number;
  clientSecrets: number;
  recoveryCodes: number;
  oauthCodes: number;
  deviceCodes: number;
}

export class LegacyCredentialRetirementService {
  private readonly config: IssuaryRuntimeConfig;
  private readonly mikro: MikroService;
  private readonly logger: Logger;

  public constructor(
    config: IssuaryRuntimeConfig,
    mikro: MikroService,
    logger: Logger,
  ) {
    this.config = config;
    this.mikro = mikro;
    this.logger = logger;
  }

  public async count(): Promise<LegacyCredentialCounts> {
    const em = this.mikro.orm.em.fork();
    const [passwords, clientSecrets, recoveryCodes, oauthCodes, deviceCodes] =
      await Promise.all([
        em.count(UserEntity, {
          password_hash: { $like: LEGACY_HASH_PATTERN },
        }),
        em.count(OAuthClientEntitySchema, {
          clientSecretHash: { $like: LEGACY_HASH_PATTERN },
        }),
        em.count(UserTotpRecoveryCodeEntitySchema, {
          code_hash: { $like: LEGACY_HASH_PATTERN },
        }),
        em.count(OAuthCodeEntitySchema, {
          codeHash: { $like: LEGACY_HASH_PATTERN },
        }),
        em.count(OAuthDeviceCodeEntitySchema, {
          $or: [
            { deviceCodeHash: { $like: LEGACY_HASH_PATTERN } },
            { userCodeHash: { $like: LEGACY_HASH_PATTERN } },
          ],
        }),
      ]);

    return { passwords, clientSecrets, recoveryCodes, oauthCodes, deviceCodes };
  }

  public async countPasswordResetRequired(): Promise<number> {
    return this.mikro.orm.em.fork().count(UserEntity, {
      password_reset_required: true,
    });
  }

  public async retireIfEnabled(): Promise<LegacyCredentialCounts> {
    const before = await this.count();
    if (!this.config.security.retire_legacy_v1_credentials) {
      return before;
    }

    const em = this.mikro.orm.em.fork();
    const configManagedPasswordCount = await em.count(UserEntity, {
      managed_by: 'config',
      password_hash: { $like: LEGACY_HASH_PATTERN },
    });
    if (configManagedPasswordCount > 0) {
      throw new Error(
        'Config-managed users still have v1 password hashes after config seeding.',
      );
    }

    await em.transactional(async (tx) => {
      await tx.nativeUpdate(
        UserEntity,
        {
          managed_by: 'database',
          password_hash: { $like: LEGACY_HASH_PATTERN },
        },
        { password_hash: null, password_reset_required: true },
      );
      await tx.nativeUpdate(
        OAuthClientEntitySchema,
        { clientSecretHash: { $like: LEGACY_HASH_PATTERN } },
        {
          enabled: false,
          clientSecretHash: RETIRED_CLIENT_SECRET_HASH,
        },
      );
      await tx.nativeDelete(UserTotpRecoveryCodeEntitySchema, {
        code_hash: { $like: LEGACY_HASH_PATTERN },
      });
      await tx.nativeDelete(OAuthCodeEntitySchema, {
        codeHash: { $like: LEGACY_HASH_PATTERN },
      });
      await tx.nativeDelete(OAuthDeviceCodeEntitySchema, {
        $or: [
          { deviceCodeHash: { $like: LEGACY_HASH_PATTERN } },
          { userCodeHash: { $like: LEGACY_HASH_PATTERN } },
        ],
      });
    });

    const remaining = await this.count();
    const remainingTotal = Object.values(remaining).reduce(
      (total, value) => total + value,
      0,
    );
    if (remainingTotal > 0) {
      throw new Error('Legacy v1 credential retirement did not reach zero.');
    }

    this.logger.warn(
      { retiredLegacyCredentials: before },
      'Legacy v1 credentials were irreversibly retired',
    );
    return remaining;
  }
}
