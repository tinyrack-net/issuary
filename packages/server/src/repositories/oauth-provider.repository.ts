import { EntityRepository } from '@mikro-orm/core';
import type { IOAuthProviderEntity } from '../entities/oauth-provider.entity.ts';

export class OAuthProviderRepository extends EntityRepository<IOAuthProviderEntity> {}
