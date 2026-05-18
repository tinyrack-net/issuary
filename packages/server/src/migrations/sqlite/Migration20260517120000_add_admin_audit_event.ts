import { Migration } from '@mikro-orm/migrations';

export class Migration20260517120000_add_admin_audit_event extends Migration {
  override up(): void | Promise<void> {
    this.addSql(
      `create table \`admin_audit_event\` (\`id\` text not null primary key, \`created_at\` datetime not null, \`updated_at\` datetime not null, \`actor_sub\` text not null, \`action\` text not null, \`target_type\` text not null, \`target_id\` text not null, \`metadata_json\` text not null, \`ip\` text null, \`user_agent\` text null) /* Admin API audit events */;`,
    );
    this.addSql(
      `create index \`admin_audit_event_created_at_idx\` on \`admin_audit_event\` (\`created_at\`);`,
    );
    this.addSql(
      `create index \`admin_audit_event_actor_sub_idx\` on \`admin_audit_event\` (\`actor_sub\`);`,
    );
    this.addSql(
      `create index \`admin_audit_event_target_idx\` on \`admin_audit_event\` (\`target_type\`, \`target_id\`);`,
    );
  }
}
