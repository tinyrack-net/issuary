import { Migration20260509171036_initial } from './Migration20260509171036_initial.js';
import { Migration20260512120000_add_scheduler_jobs } from './Migration20260512120000_add_scheduler_jobs.js';
import { Migration20260517120000_add_admin_audit_event } from './Migration20260517120000_add_admin_audit_event.js';

export const POSTGRES_MIGRATIONS = [
  Migration20260509171036_initial,
  Migration20260512120000_add_scheduler_jobs,
  Migration20260517120000_add_admin_audit_event,
];
