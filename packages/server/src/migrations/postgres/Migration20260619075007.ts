import { Migration } from '@mikro-orm/migrations';

export class Migration20260619075007 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table "oauth_device_code" ("id" uuid not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "device_code_hash" varchar(255) not null, "user_code_hash" varchar(255) not null, "client_id" varchar(255) not null, "scope" jsonb not null default '[]', "expires_at" timestamptz not null, "authorized_user_sub" varchar(255) null, "authorized_at" timestamptz null, "consumed_at" timestamptz null, primary key ("id"));`,
    );
    this.addSql(
      `comment on table "oauth_device_code" is 'Issued OAuth device authorization grants';`,
    );
    this.addSql(
      `comment on column "oauth_device_code"."created_at" is 'Timestamp when the entity was created';`,
    );
    this.addSql(
      `comment on column "oauth_device_code"."updated_at" is 'Timestamp when the entity was last updated';`,
    );
    this.addSql(
      `comment on column "oauth_device_code"."device_code_hash" is 'Hash of the issued device_code';`,
    );
    this.addSql(
      `comment on column "oauth_device_code"."user_code_hash" is 'Hash of the user-facing verification code';`,
    );
    this.addSql(
      `comment on column "oauth_device_code"."client_id" is 'Reference to the OAuth client that requested the device code';`,
    );
    this.addSql(
      `comment on column "oauth_device_code"."scope" is 'Scopes requested by the device authorization request';`,
    );
    this.addSql(
      `comment on column "oauth_device_code"."expires_at" is 'Absolute expiry timestamp for the code';`,
    );
    this.addSql(
      `comment on column "oauth_device_code"."authorized_user_sub" is 'User that approved the device authorization request';`,
    );
    this.addSql(
      `comment on column "oauth_device_code"."authorized_at" is 'Timestamp when the user approved the request';`,
    );
    this.addSql(
      `comment on column "oauth_device_code"."consumed_at" is 'Timestamp when the device code was exchanged';`,
    );
    this.addSql(
      `alter table "oauth_device_code" add constraint "oauth_device_code_device_code_hash_unique" unique ("device_code_hash");`,
    );
    this.addSql(
      `alter table "oauth_device_code" add constraint "oauth_device_code_user_code_hash_unique" unique ("user_code_hash");`,
    );
    this.addSql(
      `create index "oauth_device_code_device_hash_idx" on "oauth_device_code" ("device_code_hash");`,
    );
    this.addSql(
      `create index "oauth_device_code_user_hash_idx" on "oauth_device_code" ("user_code_hash");`,
    );
    this.addSql(
      `create index "oauth_device_code_expired_at_idx" on "oauth_device_code" ("expires_at");`,
    );

    this.addSql(
      `alter table "oauth_device_code" add constraint "oauth_device_code_client_id_foreign" foreign key ("client_id") references "oauth_client" ("id");`,
    );
    this.addSql(
      `alter table "oauth_device_code" add constraint "oauth_device_code_authorized_user_sub_foreign" foreign key ("authorized_user_sub") references "user" ("sub") on delete set null;`,
    );

    this.addSql(
      `comment on column "background_jobs"."id" is 'Stable background job execution id';`,
    );
    this.addSql(
      `comment on column "background_jobs"."created_at" is 'Timestamp when the entity was created';`,
    );
    this.addSql(
      `comment on column "background_jobs"."updated_at" is 'Timestamp when the entity was last updated';`,
    );
    this.addSql(
      `comment on column "background_jobs"."job_id" is 'Registered background job identifier';`,
    );
    this.addSql(
      `comment on column "background_jobs"."payload" is 'Serialized JSON job payload';`,
    );
    this.addSql(
      `comment on column "background_jobs"."available_at" is 'Earliest time this job can run';`,
    );
    this.addSql(
      `comment on column "background_jobs"."locked_by" is 'Scheduler instance holding the lease';`,
    );
    this.addSql(
      `comment on column "background_jobs"."locked_until" is 'Lease expiration timestamp';`,
    );
    this.addSql(
      `comment on column "background_jobs"."attempt_count" is 'Total run attempts';`,
    );
    this.addSql(
      `comment on column "background_jobs"."max_attempts" is 'Maximum run attempts';`,
    );
    this.addSql(
      `comment on column "background_jobs"."last_error" is 'Last failure message';`,
    );
    this.addSql(
      `comment on column "background_jobs"."completed_at" is 'Completion timestamp';`,
    );

    this.addSql(
      `alter table "oauth_client" add "post_logout_redirect_uris" jsonb not null default '[]', add "web_origins" jsonb not null default '[]';`,
    );

    this.addSql(
      `comment on column "scheduled_jobs"."id" is 'Stable scheduler job identifier';`,
    );
    this.addSql(
      `comment on column "scheduled_jobs"."created_at" is 'Timestamp when the entity was created';`,
    );
    this.addSql(
      `comment on column "scheduled_jobs"."updated_at" is 'Timestamp when the entity was last updated';`,
    );
    this.addSql(
      `comment on column "scheduled_jobs"."name" is 'Human-readable scheduler job name';`,
    );
    this.addSql(
      `comment on column "scheduled_jobs"."enabled" is 'Whether the scheduler job is enabled';`,
    );
    this.addSql(
      `comment on column "scheduled_jobs"."cron" is 'Cron expression for the job schedule';`,
    );
    this.addSql(
      `comment on column "scheduled_jobs"."next_run_at" is 'Next scheduled run timestamp';`,
    );
    this.addSql(
      `comment on column "scheduled_jobs"."last_run_at" is 'Last run start timestamp';`,
    );
    this.addSql(
      `comment on column "scheduled_jobs"."last_success_at" is 'Last successful completion timestamp';`,
    );
    this.addSql(
      `comment on column "scheduled_jobs"."last_error_at" is 'Last failed completion timestamp';`,
    );
    this.addSql(
      `comment on column "scheduled_jobs"."last_error" is 'Last failure message';`,
    );
    this.addSql(
      `comment on column "scheduled_jobs"."locked_by" is 'Scheduler instance holding the lease';`,
    );
    this.addSql(
      `comment on column "scheduled_jobs"."locked_until" is 'Lease expiration timestamp';`,
    );
    this.addSql(
      `comment on column "scheduled_jobs"."run_count" is 'Total run attempts';`,
    );
    this.addSql(
      `comment on column "scheduled_jobs"."failure_count" is 'Total failed run attempts';`,
    );

    this.addSql(`comment on table "user_oauth" is '';`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "oauth_device_code" cascade;`);

    this.addSql(`comment on column "background_jobs"."id" is null;`);
    this.addSql(`comment on column "background_jobs"."created_at" is null;`);
    this.addSql(`comment on column "background_jobs"."updated_at" is null;`);
    this.addSql(`comment on column "background_jobs"."job_id" is null;`);
    this.addSql(`comment on column "background_jobs"."payload" is null;`);
    this.addSql(`comment on column "background_jobs"."available_at" is null;`);
    this.addSql(`comment on column "background_jobs"."locked_by" is null;`);
    this.addSql(`comment on column "background_jobs"."locked_until" is null;`);
    this.addSql(`comment on column "background_jobs"."attempt_count" is null;`);
    this.addSql(`comment on column "background_jobs"."max_attempts" is null;`);
    this.addSql(`comment on column "background_jobs"."last_error" is null;`);
    this.addSql(`comment on column "background_jobs"."completed_at" is null;`);

    this.addSql(
      `alter table "oauth_client" drop column "post_logout_redirect_uris", drop column "web_origins";`,
    );

    this.addSql(`comment on column "scheduled_jobs"."id" is null;`);
    this.addSql(`comment on column "scheduled_jobs"."created_at" is null;`);
    this.addSql(`comment on column "scheduled_jobs"."updated_at" is null;`);
    this.addSql(`comment on column "scheduled_jobs"."name" is null;`);
    this.addSql(`comment on column "scheduled_jobs"."enabled" is null;`);
    this.addSql(`comment on column "scheduled_jobs"."cron" is null;`);
    this.addSql(`comment on column "scheduled_jobs"."next_run_at" is null;`);
    this.addSql(`comment on column "scheduled_jobs"."last_run_at" is null;`);
    this.addSql(
      `comment on column "scheduled_jobs"."last_success_at" is null;`,
    );
    this.addSql(`comment on column "scheduled_jobs"."last_error_at" is null;`);
    this.addSql(`comment on column "scheduled_jobs"."last_error" is null;`);
    this.addSql(`comment on column "scheduled_jobs"."locked_by" is null;`);
    this.addSql(`comment on column "scheduled_jobs"."locked_until" is null;`);
    this.addSql(`comment on column "scheduled_jobs"."run_count" is null;`);
    this.addSql(`comment on column "scheduled_jobs"."failure_count" is null;`);

    this.addSql(
      `comment on table "user_oauth" is 'OAuth accounts linked to users';`,
    );
  }
}
