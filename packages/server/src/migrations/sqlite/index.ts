import { Migration20260509171226_initial } from './Migration20260509171226_initial.js';
import { Migration20260512120000_add_scheduler_jobs } from './Migration20260512120000_add_scheduler_jobs.js';
import { Migration20260619075330 } from './Migration20260619075330.js';
import { Migration20260619191600_unique_oauth_client_client_id } from './Migration20260619191600_unique_oauth_client_client_id.js';
import { Migration20260620025358_add_oauth_client_skip_consent } from './Migration20260620025358_add_oauth_client_skip_consent.js';

export const SQLITE_MIGRATIONS = [
  Migration20260509171226_initial,
  Migration20260512120000_add_scheduler_jobs,
  Migration20260619075330,
  Migration20260619191600_unique_oauth_client_client_id,
  Migration20260620025358_add_oauth_client_skip_consent,
];
