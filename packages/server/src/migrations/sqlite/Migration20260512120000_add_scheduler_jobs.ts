import { Migration } from '@mikro-orm/migrations';

export class Migration20260512120000_add_scheduler_jobs extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table \`scheduled_jobs\` (\`id\` text not null primary key, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`name\` text not null, \`enabled\` integer not null default true, \`cron\` text not null, \`next_run_at\` datetime null, \`last_run_at\` datetime null, \`last_success_at\` datetime null, \`last_error_at\` datetime null, \`last_error\` text null, \`locked_by\` text null, \`locked_until\` datetime null, \`run_count\` integer not null default 0, \`failure_count\` integer not null default 0) /* Persistent scheduler jobs and leases */;`,
    );
    this.addSql(
      `create index \`scheduled_jobs_enabled_next_run_at_idx\` on \`scheduled_jobs\` (\`enabled\`, \`next_run_at\`);`,
    );
    this.addSql(
      `create index \`scheduled_jobs_locked_until_idx\` on \`scheduled_jobs\` (\`locked_until\`);`,
    );
    this.addSql(
      `create table \`background_jobs\` (\`id\` text not null primary key, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`job_id\` text not null, \`payload\` text not null, \`status\` text not null default 'pending', \`available_at\` datetime not null, \`locked_by\` text null, \`locked_until\` datetime null, \`attempt_count\` integer not null default 0, \`max_attempts\` integer not null default 3, \`last_error\` text null, \`completed_at\` datetime null) /* Durable background job queue */;`,
    );
    this.addSql(
      `create index \`background_jobs_status_available_at_idx\` on \`background_jobs\` (\`status\`, \`available_at\`);`,
    );
    this.addSql(
      `create index \`background_jobs_locked_until_idx\` on \`background_jobs\` (\`locked_until\`);`,
    );
    this.addSql(
      `create index \`background_jobs_job_id_idx\` on \`background_jobs\` (\`job_id\`);`,
    );
  }
}
