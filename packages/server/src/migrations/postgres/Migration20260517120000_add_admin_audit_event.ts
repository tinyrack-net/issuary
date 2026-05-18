import { Migration } from '@mikro-orm/migrations';

export class Migration20260517120000_add_admin_audit_event extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table "admin_audit_event" ("id" varchar(255) not null, "created_at" timestamptz not null, "updated_at" timestamptz not null, "actor_sub" varchar(255) not null, "action" varchar(255) not null, "target_type" varchar(255) not null, "target_id" varchar(255) not null, "metadata_json" text not null, "ip" varchar(255) null, "user_agent" text null, primary key ("id"));`,
    );
    this.addSql(
      `comment on table "admin_audit_event" is 'Admin API audit events';`,
    );
    this.addSql(
      `create index "admin_audit_event_created_at_idx" on "admin_audit_event" ("created_at");`,
    );
    this.addSql(
      `create index "admin_audit_event_actor_sub_idx" on "admin_audit_event" ("actor_sub");`,
    );
    this.addSql(
      `create index "admin_audit_event_target_idx" on "admin_audit_event" ("target_type", "target_id");`,
    );
  }
}
