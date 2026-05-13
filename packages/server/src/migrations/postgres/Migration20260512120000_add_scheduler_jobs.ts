import { Migration } from '@mikro-orm/migrations';

export class Migration20260512120000_add_scheduler_jobs extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table "scheduled_jobs" ("id" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "name" varchar(255) not null, "enabled" boolean not null default true, "cron" varchar(255) not null, "next_run_at" timestamptz null, "last_run_at" timestamptz null, "last_success_at" timestamptz null, "last_error_at" timestamptz null, "last_error" text null, "locked_by" varchar(255) null, "locked_until" timestamptz null, "run_count" int not null default 0 check ("run_count" >= 0), "failure_count" int not null default 0 check ("failure_count" >= 0), primary key ("id"));`,
    );
    this.addSql(
      `comment on table "scheduled_jobs" is 'Persistent scheduler jobs and leases';`,
    );
    this.addSql(
      `create index "scheduled_jobs_enabled_next_run_at_idx" on "scheduled_jobs" ("enabled", "next_run_at");`,
    );
    this.addSql(
      `create index "scheduled_jobs_locked_until_idx" on "scheduled_jobs" ("locked_until");`,
    );
    this.addSql(
      `create table "background_jobs" ("id" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "job_id" varchar(255) not null, "payload" text not null, "status" varchar(255) not null default 'pending' check ("status" in ('pending', 'running', 'succeeded', 'failed')), "available_at" timestamptz not null, "locked_by" varchar(255) null, "locked_until" timestamptz null, "attempt_count" int not null default 0 check ("attempt_count" >= 0), "max_attempts" int not null default 3 check ("max_attempts" > 0), "last_error" text null, "completed_at" timestamptz null, primary key ("id"));`,
    );
    this.addSql(
      `comment on table "background_jobs" is 'Durable background job queue';`,
    );
    this.addSql(
      `create index "background_jobs_status_available_at_idx" on "background_jobs" ("status", "available_at");`,
    );
    this.addSql(
      `create index "background_jobs_locked_until_idx" on "background_jobs" ("locked_until");`,
    );
    this.addSql(
      `create index "background_jobs_job_id_idx" on "background_jobs" ("job_id");`,
    );
  }
}
