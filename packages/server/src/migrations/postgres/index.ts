import { Migration20260509171036_initial } from './Migration20260509171036_initial.js';
import { Migration20260512120000_add_scheduler_jobs } from './Migration20260512120000_add_scheduler_jobs.js';

export const POSTGRES_MIGRATIONS = [
  Migration20260509171036_initial,
  Migration20260512120000_add_scheduler_jobs,
];
