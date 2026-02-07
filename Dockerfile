# ===== Stage 1: Base =====
FROM node:24-slim AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ===== Stage 2: Dependencies =====
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/frontend/package.json ./packages/frontend/
COPY packages/backend/package.json ./packages/backend/
RUN pnpm install --frozen-lockfile

# ===== Stage 3: Frontend Build =====
FROM deps AS frontend-build
COPY packages/frontend ./packages/frontend
RUN pnpm --filter @tinyauth/frontend build

# ===== Stage 4: Backend Build =====
FROM deps AS backend-build
COPY packages/backend ./packages/backend
COPY --from=frontend-build /app/packages/backend/public ./packages/backend/public
# tsc-alias는 build 스크립트에 포함됨
RUN pnpm --filter @tinyauth/backend build

# ===== Stage 5: Production Dependencies =====
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/backend/package.json ./packages/backend/
RUN pnpm install --frozen-lockfile --filter @tinyauth/backend

# ===== Stage 6: Production =====
FROM node:24-slim AS production

# 보안: non-root 사용자 생성
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -m nodejs

WORKDIR /app

# 의존성 복사 (이미 빌드된 네이티브 모듈 포함)
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/packages/backend/node_modules ./packages/backend/node_modules
COPY --from=prod-deps /app/package.json ./package.json
COPY --from=prod-deps /app/packages/backend/package.json ./packages/backend/package.json

# 빌드 결과물 복사
COPY --from=backend-build /app/packages/backend/dist ./packages/backend/dist
COPY --from=backend-build /app/packages/backend/public ./packages/backend/public

# 디렉토리 권한 설정
RUN mkdir -p /app/packages/backend/data && \
    chown -R nodejs:nodejs /app

WORKDIR /app/packages/backend

# non-root 사용자로 전환
USER nodejs

EXPOSE 8080

ENV NODE_ENV=production
ENV CONFIG_PATH=/opt/config.yaml

# 헬스체크
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:8080/.well-known/openid-configuration').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "dist/index.js"]
