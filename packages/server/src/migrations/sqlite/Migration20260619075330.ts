import { Migration } from '@mikro-orm/migrations';

export class Migration20260619075330 extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table \`oauth_device_code\` (\`id\` text not null primary key, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`device_code_hash\` text not null, \`user_code_hash\` text not null, \`client_id\` text not null, \`scope\` json not null default '[]', \`expires_at\` datetime not null, \`authorized_user_sub\` text null, \`authorized_at\` datetime null, \`consumed_at\` datetime null, constraint \`oauth_device_code_client_id_foreign\` foreign key (\`client_id\`) references \`oauth_client\` (\`id\`), constraint \`oauth_device_code_authorized_user_sub_foreign\` foreign key (\`authorized_user_sub\`) references \`user\` (\`sub\`) on delete set null) /* Issued OAuth device authorization grants */;`,
    );
    this.addSql(
      `create unique index \`oauth_device_code_device_code_hash_unique\` on \`oauth_device_code\` (\`device_code_hash\`);`,
    );
    this.addSql(
      `create unique index \`oauth_device_code_user_code_hash_unique\` on \`oauth_device_code\` (\`user_code_hash\`);`,
    );
    this.addSql(
      `create index \`oauth_device_code_client_id_index\` on \`oauth_device_code\` (\`client_id\`);`,
    );
    this.addSql(
      `create index \`oauth_device_code_authorized_user_sub_index\` on \`oauth_device_code\` (\`authorized_user_sub\`);`,
    );
    this.addSql(
      `create index \`oauth_device_code_device_hash_idx\` on \`oauth_device_code\` (\`device_code_hash\`);`,
    );
    this.addSql(
      `create index \`oauth_device_code_user_hash_idx\` on \`oauth_device_code\` (\`user_code_hash\`);`,
    );
    this.addSql(
      `create index \`oauth_device_code_expired_at_idx\` on \`oauth_device_code\` (\`expires_at\`);`,
    );

    this.addSql(`pragma foreign_keys = off;`);
    this.addSql(
      `create table \`background_jobs__temp_alter\` (\`id\` text not null primary key, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`job_id\` text not null, \`payload\` text not null, \`status\` text check (status in ('pending', 'running', 'succeeded', 'failed')) not null default 'pending', \`available_at\` datetime not null, \`locked_by\` text null, \`locked_until\` datetime null, \`attempt_count\` integer check (attempt_count >= 0) not null default 0, \`max_attempts\` integer check (max_attempts > 0) not null default 3, \`last_error\` text null, \`completed_at\` datetime null) /* Durable background job queue */;`,
    );
    this.addSql(
      `insert into \`background_jobs__temp_alter\` select \`id\`, \`created_at\`, \`updated_at\`, \`job_id\`, \`payload\`, \`status\`, \`available_at\`, \`locked_by\`, \`locked_until\`, \`attempt_count\`, \`max_attempts\`, \`last_error\`, \`completed_at\` from \`background_jobs\`;`,
    );
    this.addSql(`drop table \`background_jobs\`;`);
    this.addSql(
      `alter table \`background_jobs__temp_alter\` rename to \`background_jobs\`;`,
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
    this.addSql(`pragma foreign_keys = on;`);

    this.addSql(
      `alter table \`oauth_client\` add column \`post_logout_redirect_uris\` json not null default '[]';`,
    );
    this.addSql(
      `alter table \`oauth_client\` add column \`web_origins\` json not null default '[]';`,
    );

    this.addSql(`pragma foreign_keys = off;`);
    this.addSql(
      `create table \`user_oauth__temp_alter\` (\`id\` integer not null primary key autoincrement, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`user_sub\` text not null, \`provider_name\` text not null, \`provider_user_id\` text not null, \`access_token\` text not null, \`refresh_token\` text not null, \`expires_at\` datetime null, constraint \`user_oauth_user_sub_foreign\` foreign key (\`user_sub\`) references \`user\` (\`sub\`) on update no action on delete no action);`,
    );
    this.addSql(
      `insert into \`user_oauth__temp_alter\` select \`id\`, \`created_at\`, \`updated_at\`, \`user_sub\`, \`provider_name\`, \`provider_user_id\`, \`access_token\`, \`refresh_token\`, \`expires_at\` from \`user_oauth\`;`,
    );
    this.addSql(`drop table \`user_oauth\`;`);
    this.addSql(
      `alter table \`user_oauth__temp_alter\` rename to \`user_oauth\`;`,
    );
    this.addSql(
      `create index \`user_oauth_user_sub_idx\` on \`user_oauth\` (\`user_sub\`);`,
    );
    this.addSql(
      `create index \`user_oauth_user_provider_idx\` on \`user_oauth\` (\`user_sub\`, \`provider_name\`);`,
    );
    this.addSql(
      `create unique index \`user_oauth_provider_unique\` on \`user_oauth\` (\`provider_name\`, \`provider_user_id\`);`,
    );
    this.addSql(`pragma foreign_keys = on;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists \`oauth_device_code\`;`);

    this.addSql(`pragma foreign_keys = off;`);
    this.addSql(
      `create table \`background_jobs__temp_alter\` (\`id\` TEXT not null primary key, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`job_id\` TEXT not null, \`payload\` TEXT not null, \`status\` TEXT check (\`status\` in ('pending', 'running', 'succeeded', 'failed')) not null default 'pending', \`available_at\` datetime not null, \`locked_by\` TEXT null, \`locked_until\` datetime null, \`attempt_count\` INTEGER check (\`attempt_count\` >= 0) not null default 0, \`max_attempts\` INTEGER check (\`max_attempts\` > 0) not null default 3, \`last_error\` TEXT null, \`completed_at\` datetime null);`,
    );
    this.addSql(
      `insert into \`background_jobs__temp_alter\` select \`id\`, \`created_at\`, \`updated_at\`, \`job_id\`, \`payload\`, \`status\`, \`available_at\`, \`locked_by\`, \`locked_until\`, \`attempt_count\`, \`max_attempts\`, \`last_error\`, \`completed_at\` from \`background_jobs\`;`,
    );
    this.addSql(`drop table \`background_jobs\`;`);
    this.addSql(
      `alter table \`background_jobs__temp_alter\` rename to \`background_jobs\`;`,
    );
    this.addSql(
      `create index \`background_jobs_job_id_idx\` on \`background_jobs\` (\`job_id\`);`,
    );
    this.addSql(
      `create index \`background_jobs_locked_until_idx\` on \`background_jobs\` (\`locked_until\`);`,
    );
    this.addSql(
      `create index \`background_jobs_status_available_at_idx\` on \`background_jobs\` (\`status\`, \`available_at\`);`,
    );
    this.addSql(`pragma foreign_keys = on;`);

    this.addSql(
      `alter table \`oauth_client\` drop column \`post_logout_redirect_uris\`;`,
    );
    this.addSql(`alter table \`oauth_client\` drop column \`web_origins\`;`);

    this.addSql(`pragma foreign_keys = off;`);
    this.addSql(
      `create table \`user_oauth__temp_alter\` (\`id\` integer not null primary key autoincrement, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`user_sub\` TEXT not null, \`provider_name\` TEXT not null, \`provider_user_id\` TEXT not null, \`access_token\` TEXT not null, \`refresh_token\` TEXT not null, \`expires_at\` datetime null, constraint \`user_oauth_user_sub_foreign\` foreign key (\`user_sub\`) references \`user\` (\`sub\`) on update no action on delete no action);`,
    );
    this.addSql(
      `insert into \`user_oauth__temp_alter\` select \`id\`, \`created_at\`, \`updated_at\`, \`user_sub\`, \`provider_name\`, \`provider_user_id\`, \`access_token\`, \`refresh_token\`, \`expires_at\` from \`user_oauth\`;`,
    );
    this.addSql(`drop table \`user_oauth\`;`);
    this.addSql(
      `alter table \`user_oauth__temp_alter\` rename to \`user_oauth\`;`,
    );
    this.addSql(
      `create unique index \`user_oauth_provider_unique\` on \`user_oauth\` (\`provider_name\`, \`provider_user_id\`);`,
    );
    this.addSql(
      `create index \`user_oauth_user_provider_idx\` on \`user_oauth\` (\`user_sub\`, \`provider_name\`);`,
    );
    this.addSql(
      `create index \`user_oauth_user_sub_idx\` on \`user_oauth\` (\`user_sub\`);`,
    );
    this.addSql(`pragma foreign_keys = on;`);
  }
}
