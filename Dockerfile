# Multi-stage Dockerfile for GlowGuide Retention Agent
# Builds API, Workers, and Web packages

# Stage 1: Build shared package
FROM node:20-alpine AS shared-builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages/shared ./packages/shared
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate
RUN pnpm install --frozen-lockfile --no-optional
WORKDIR /app/packages/shared
RUN pnpm build

# Stage 2: Build API
FROM node:20-alpine AS api-builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages/shared ./packages/shared
COPY packages/api ./packages/api
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate
RUN pnpm install --frozen-lockfile --no-optional
WORKDIR /app/packages/shared
RUN pnpm build
WORKDIR /app/packages/api
RUN pnpm build

# Stage 3: Build Workers
FROM node:20-alpine AS workers-builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages/shared ./packages/shared
COPY packages/workers ./packages/workers
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate
RUN pnpm install --frozen-lockfile --no-optional
WORKDIR /app/packages/shared
RUN pnpm build
WORKDIR /app/packages/workers
RUN pnpm build

# Stage 4: Build Web (optional deps needed for lightningcss/Tailwind platform binary)
FROM node:20-alpine AS web-builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages/shared ./packages/shared
COPY packages/web ./packages/web
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate
RUN pnpm install --frozen-lockfile
WORKDIR /app/packages/shared
RUN pnpm build
WORKDIR /app/packages/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# Stage 5: Production - API (use builder output, prune to prod deps only)
FROM api-builder AS api
WORKDIR /app
RUN pnpm prune --prod
WORKDIR /app/packages/api
EXPOSE 3001
# New Relic: pass NEW_RELIC_LICENSE_KEY and NEW_RELIC_APP_NAME=glowguide-api at runtime
CMD ["node", "-r", "newrelic", "dist/index.js"]

# Stage 6: Production - Workers (use builder output, prune to prod deps only)
FROM workers-builder AS workers
WORKDIR /app
RUN pnpm prune --prod
WORKDIR /app/packages/workers
# New Relic: pass NEW_RELIC_LICENSE_KEY and NEW_RELIC_APP_NAME=glowguide-workers at runtime
CMD ["node", "-r", "newrelic", "dist/index.js"]

# Stage 7: Production - Web (use builder output, prune to prod deps only)
FROM web-builder AS web
WORKDIR /app
RUN pnpm prune --prod
WORKDIR /app/packages/web
ENV NEXT_TELEMETRY_DISABLED=1
EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]
