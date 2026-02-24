import { EntityRepository } from '@mikro-orm/core';
import type { IOAuthClientEntity } from '#backend/entities/oauth-client.entity.js';

export class OAuthClientRepository extends EntityRepository<IOAuthClientEntity> {}
