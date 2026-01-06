import { EntityRepository } from '@mikro-orm/core';
import type { OAuthCodeEntity } from '@/entities/oauth-code.entity.js';

export class OAuthCodeRepository extends EntityRepository<OAuthCodeEntity> { }
