import { Migration20260509171226_initial } from './Migration20260509171226_initial.js';
import { Migration20260512120000_add_scheduler_jobs } from './Migration20260512120000_add_scheduler_jobs.js';
import { Migration20260619075330 } from './Migration20260619075330.js';
import { Migration20260619191600_unique_oauth_client_client_id } from './Migration20260619191600_unique_oauth_client_client_id.js';
import { Migration20260620025358_add_oauth_client_skip_consent } from './Migration20260620025358_add_oauth_client_skip_consent.js';
import { Migration20260624190500_add_oauth_device_denied_at } from './Migration20260624190500_add_oauth_device_denied_at.js';
import { Migration20260624223000_add_oauth_device_poll_state } from './Migration20260624223000_add_oauth_device_poll_state.js';
import { Migration20260626103000_allow_revoked_token_without_user } from './Migration20260626103000_allow_revoked_token_without_user.js';
import { Migration20260825110000_add_password_reset_required } from './Migration20260825110000_add_password_reset_required.js';
import { Migration20260825140000_drop_password_reset_required } from './Migration20260825140000_drop_password_reset_required.js';

export const SQLITE_MIGRATIONS = [
  Migration20260509171226_initial,
  Migration20260512120000_add_scheduler_jobs,
  Migration20260619075330,
  Migration20260619191600_unique_oauth_client_client_id,
  Migration20260620025358_add_oauth_client_skip_consent,
  Migration20260624190500_add_oauth_device_denied_at,
  Migration20260624223000_add_oauth_device_poll_state,
  Migration20260626103000_allow_revoked_token_without_user,
  Migration20260825110000_add_password_reset_required,
  Migration20260825140000_drop_password_reset_required,
];
