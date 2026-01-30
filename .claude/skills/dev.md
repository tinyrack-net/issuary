# dev

Start development servers for the TinyAuth monorepo.

## Usage

```
/dev [options]
```

## Options

- (none) or `--all`: Start all packages in parallel
- `--backend`: Start only backend server (port 8080)
- `--frontend`: Start only frontend server (port 8081)
- `--examples`: Start example apps

## Instructions

When the user invokes this skill:

1. Parse the arguments to determine which package(s) to start
2. Run the appropriate command:

### Start all packages (default)
```bash
pnpm dev
```

### Start backend only
```bash
pnpm --filter @tinyauth/backend dev
```

### Start frontend only
```bash
pnpm --filter @tinyauth/frontend dev
```

### Start examples
```bash
pnpm --filter "./examples/*" dev
```

3. The command will run in the foreground and show server output
4. Inform the user of the ports:
   - Backend: http://localhost:8080
   - Frontend: http://localhost:8081
