# Stage 1: Install dependencies
FROM node:24-slim AS base

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/server/package.json packages/server/package.json
COPY packages/frontend/package.json packages/frontend/package.json
COPY packages/standalone/package.json packages/standalone/package.json
COPY packages/tools/package.json packages/tools/package.json

RUN pnpm install --frozen-lockfile

# Stage 2: Build frontend and server
FROM base AS build

COPY packages/frontend/ packages/frontend/
COPY packages/server/ packages/server/
COPY packages/standalone/ packages/standalone/
COPY packages/tools/ packages/tools/

RUN pnpm --filter @tinyrack/tinyauth-server build
RUN pnpm --filter @tinyrack/tinyauth-frontend build
RUN pnpm --filter @tinyrack/tinyauth-standalone build
RUN pnpm --filter @tinyrack/tinyauth-standalone deploy --prod --legacy /app/deploy

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
COPY --from=build --chown=tinyauth:tinyauth /app/packages/server/public/ /opt/tinyauth/frontend/

USER tinyauth

EXPOSE 8080

CMD ["node", "dist/cli.js", "serve"]
