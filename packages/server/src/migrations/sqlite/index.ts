import { Migration20260509171226_initial } from './Migration20260509171226_initial.js';
import { Migration20260512120000_add_scheduler_jobs } from './Migration20260512120000_add_scheduler_jobs.js';

export const SQLITE_MIGRATIONS = [
  Migration20260509171226_initial,
  Migration20260512120000_add_scheduler_jobs,
];
