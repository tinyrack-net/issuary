import { Cron } from 'croner';

export function validateCronExpression(expression: string): string {
  let job: Cron | undefined;
  try {
    job = new Cron(expression, { paused: true });
    const nextRunAt = job.nextRun(new Date()) ?? null;
    if (!nextRunAt) {
      throw new Error('Cron expression has no future run');
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid cron expression "${expression}": ${message}`);
  } finally {
    job?.stop();
  }

  return expression;
}

export function getNextCronRunAt(expression: string, from: Date): Date {
  let job: Cron | undefined;
  try {
    job = new Cron(expression, { paused: true });
    const nextRunAt = job.nextRun(from) ?? null;

    if (!nextRunAt) {
      throw new Error(`Cron expression has no future run: ${expression}`);
    }

    return nextRunAt;
  } finally {
    job?.stop();
  }
}
