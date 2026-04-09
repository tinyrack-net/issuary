import { EntityRepository } from '@mikro-orm/core';
import type { IOAuthClientEntity } from '../entities/oauth-client.entity.ts';

export class OAuthClientRepository extends EntityRepository<IOAuthClientEntity> {}
