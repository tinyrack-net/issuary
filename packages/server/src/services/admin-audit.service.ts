import type { IAdminAuditEventEntity } from '../entities/admin-audit-event.entity.ts';
import type {
  CreateAdminAuditEventParams,
  ListAdminAuditEventsParams,
} from '../repositories/admin-audit-event.repository.ts';
import type { MikroService } from './mikro.service.ts';

export type AdminAuditEventInput = CreateAdminAuditEventParams;

export type AdminAuditEventListResult = {
  events: IAdminAuditEventEntity[];
  total: number;
};

export class AdminAuditService {
  private readonly mikro: MikroService;

  public constructor(mikro: MikroService) {
    this.mikro = mikro;
  }

  public async record(
    event: AdminAuditEventInput,
  ): Promise<IAdminAuditEventEntity> {
    return this.mikro.adminAuditEvent.record(event);
  }

  public async listRecent(
    params: ListAdminAuditEventsParams,
  ): Promise<AdminAuditEventListResult> {
    const [events, total] = await this.mikro.adminAuditEvent.listRecent(params);
    return { events, total };
  }
}
