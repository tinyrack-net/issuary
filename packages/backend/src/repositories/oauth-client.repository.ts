import { EntityRepository } from '@mikro-orm/core';
import type { OAuthClientEntity } from '@/entities/oauth-client.entity.js';

export class OAuthClientRepository extends EntityRepository<OAuthClientEntity> {}
