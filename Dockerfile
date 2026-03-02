# Stage 1: Install dependencies
FROM node:24-slim AS base

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/backend/package.json packages/backend/package.json
COPY packages/frontend/package.json packages/frontend/package.json
COPY packages/standalone/package.json packages/standalone/package.json

RUN pnpm install --frozen-lockfile

# Stage 2: Build frontend and backend
FROM base AS build

COPY packages/frontend/ packages/frontend/
COPY packages/backend/ packages/backend/
COPY packages/standalone/ packages/standalone/

RUN pnpm --filter @tinyauth/frontend build

RUN pnpm --filter @tinyauth/backend build
RUN pnpm --filter @tinyauth/standalone build
RUN pnpm --filter @tinyauth/standalone deploy --prod --legacy /app/deploy

# Stage 3: Minimal runtime image
FROM node:24-slim AS runner

RUN groupadd --gid 1001 tinyauth && \
    useradd --uid 1001 --gid 1001 --create-home tinyauth && \
    mkdir -p /opt/tinyauth/frontend && \
    chown -R tinyauth:tinyauth /opt/tinyauth

WORKDIR /app

COPY --from=build --chown=tinyauth:tinyauth /app/packages/standalone/dist/ ./dist/
COPY --from=build --chown=tinyauth:tinyauth /app/deploy/node_modules/ ./node_modules/
COPY --from=build --chown=tinyauth:tinyauth /app/deploy/package.json ./package.json
COPY --from=build --chown=tinyauth:tinyauth /app/packages/backend/public/ /opt/tinyauth/frontend/

USER tinyauth

EXPOSE 8080

CMD ["node", "dist/cli.js", "serve"]
