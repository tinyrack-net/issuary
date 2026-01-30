# db-migrate

Manage MikroORM database migrations.

## Usage

```
/db-migrate <command>
```

## Commands

- `create`: Create a new migration from schema changes
- `up`: Run all pending migrations
- `down`: Rollback the last migration
- `status`: Show migration status
- `debug`: Debug database connection

## Instructions

When the user invokes this skill:

1. Parse the command argument
2. Run the appropriate MikroORM command:

### Create new migration
```bash
cd packages/backend && pnpm mikro-orm migration:create
```

### Run pending migrations
```bash
cd packages/backend && pnpm mikro-orm migration:up
```

### Rollback last migration
```bash
cd packages/backend && pnpm mikro-orm migration:down
```

### Show migration status
```bash
cd packages/backend && pnpm mikro-orm migration:list
```

### Debug database connection
```bash
cd packages/backend && pnpm mikro-orm:debug
```

3. Report the result of the operation

## Notes

- MikroORM supports PostgreSQL and SQLite
- Database configuration is in `packages/backend/src/db/`
- Entity definitions are in `packages/backend/src/entities/`
- The project uses the `mikro-orm-esm` CLI for ESM compatibility

## Database Configuration

Configuration is loaded from `config.yaml`:
- PostgreSQL: Requires `DATABASE_URL` or individual connection params
- SQLite: Uses file path from config
- In-memory: Used for testing

## Workflow

1. Modify entity files in `src/entities/`
2. Run `/db-migrate create` to generate migration
3. Review the generated migration file
4. Run `/db-migrate up` to apply
5. If issues occur, run `/db-migrate down` to rollback
