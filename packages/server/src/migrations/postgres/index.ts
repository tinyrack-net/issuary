import { Migration20260509171036_initial } from './Migration20260509171036_initial.js';
import { Migration20260512120000_add_scheduler_jobs } from './Migration20260512120000_add_scheduler_jobs.js';
import { Migration20260619075007 } from './Migration20260619075007.js';
import { Migration20260619191600_unique_oauth_client_client_id } from './Migration20260619191600_unique_oauth_client_client_id.js';
import { Migration20260620025358_add_oauth_client_skip_consent } from './Migration20260620025358_add_oauth_client_skip_consent.js';
import { Migration20260624190500_add_oauth_device_denied_at } from './Migration20260624190500_add_oauth_device_denied_at.js';
import { Migration20260624223000_add_oauth_device_poll_state } from './Migration20260624223000_add_oauth_device_poll_state.js';
import { Migration20260626103000_allow_revoked_token_without_user } from './Migration20260626103000_allow_revoked_token_without_user.js';

export const POSTGRES_MIGRATIONS = [
  Migration20260509171036_initial,
  Migration20260512120000_add_scheduler_jobs,
  Migration20260619075007,
  Migration20260619191600_unique_oauth_client_client_id,
  Migration20260620025358_add_oauth_client_skip_consent,
  Migration20260624190500_add_oauth_device_denied_at,
  Migration20260624223000_add_oauth_device_poll_state,
  Migration20260626103000_allow_revoked_token_without_user,
];
