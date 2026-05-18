import { defineEntity, type InferEntity } from '@mikro-orm/core';
import { AdminAuditEventRepository } from '../repositories/admin-audit-event.repository.ts';
import { BaseSchema } from './base.entity.ts';

export const AdminAuditEventEntitySchema = defineEntity({
  name: 'AdminAuditEventEntity',
  tableName: 'admin_audit_event',
  comment: 'Admin API audit events',
  extends: BaseSchema,
  repository: () => AdminAuditEventRepository,
  properties: (p) => ({
    id: p.string().primary().comment('Stable audit event id'),
    actorSub: p
      .string()
      .comment('Admin user subject that performed the action'),
    action: p.string().comment('Administrative action name'),
    targetType: p.string().comment('Type of resource affected'),
    targetId: p.string().comment('Identifier of resource affected'),
    metadataJson: p.text().comment('Serialized event metadata JSON'),
    ip: p.string().comment('Request IP address').nullable(),
    userAgent: p.text().comment('Request user agent').nullable(),
  }),
  indexes: [
    {
      name: 'admin_audit_event_created_at_idx',
      properties: ['created_at'],
    },
    {
      name: 'admin_audit_event_actor_sub_idx',
      properties: ['actorSub'],
    },
    {
      name: 'admin_audit_event_target_idx',
      properties: ['targetType', 'targetId'],
    },
  ],
});

export type IAdminAuditEventEntity = InferEntity<
  typeof AdminAuditEventEntitySchema
>;
