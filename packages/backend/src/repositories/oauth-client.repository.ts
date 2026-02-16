import type { IOAuthClientEntity } from '@backend/entities/oauth-client.entity.js';
import { EntityRepository } from '@mikro-orm/core';

export class OAuthClientRepository extends EntityRepository<IOAuthClientEntity> {}
