import { EntityRepository } from '@mikro-orm/core';
import type { IAdminAuditEventEntity } from '../entities/admin-audit-event.entity.ts';

export type CreateAdminAuditEventParams = {
  actorSub: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  ip?: string | undefined;
  userAgent?: string | undefined;
};

export type ListAdminAuditEventsParams = {
  limit: number;
  offset: number;
};

export class AdminAuditEventRepository extends EntityRepository<IAdminAuditEventEntity> {
  public async record(params: CreateAdminAuditEventParams) {
    const auditEvent = this.create({
      id: crypto.randomUUID(),
      actorSub: params.actorSub,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      metadataJson: JSON.stringify(params.metadata),
      ip: params.ip ?? null,
      userAgent: params.userAgent ?? null,
    });

    await this.getEntityManager().persist(auditEvent).flush();
    return auditEvent;
  }

  public async listRecent(params: ListAdminAuditEventsParams) {
    return this.findAndCount(
      {},
      {
        limit: params.limit,
        offset: params.offset,
        orderBy: { created_at: 'DESC' },
      },
    );
  }
}
