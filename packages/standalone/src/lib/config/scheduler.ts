import { SchedulerConfigSchema } from '@tinyauth/backend/config';
import type z from 'zod';

export const StandaloneSchedulerConfigSchema = SchedulerConfigSchema;

export type StandaloneSchedulerConfig = z.infer<
  typeof StandaloneSchedulerConfigSchema
>;
