# Multi-stage Dockerfile for GlowGuide Retention Agent
# Builds API, Workers, and Web packages

# Stage 1: Build shared package
FROM node:20-alpine AS shared-builder
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared ./packages/shared
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile
WORKDIR /app/packages/shared
RUN pnpm build

# Stage 2: Build API
FROM node:20-alpine AS api-builder
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared ./packages/shared
COPY packages/api ./packages/api
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile
WORKDIR /app/packages/shared
RUN pnpm build
WORKDIR /app/packages/api
RUN pnpm build

# Stage 3: Build Workers
FROM node:20-alpine AS workers-builder
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared ./packages/shared
COPY packages/workers ./packages/workers
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile
WORKDIR /app/packages/shared
RUN pnpm build
WORKDIR /app/packages/workers
RUN pnpm build

# Stage 4: Build Web
FROM node:20-alpine AS web-builder
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared ./packages/shared
COPY packages/web ./packages/web
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile
WORKDIR /app/packages/shared
RUN pnpm build
WORKDIR /app/packages/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# Stage 5: Production - API
FROM node:20-alpine AS api
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared ./packages/shared
COPY packages/api ./packages/api
RUN pnpm install --prod --frozen-lockfile
WORKDIR /app/packages/shared
RUN pnpm build
WORKDIR /app/packages/api
RUN pnpm build
EXPOSE 3001
CMD ["node", "dist/index.js"]

# Stage 6: Production - Workers
FROM node:20-alpine AS workers
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared ./packages/shared
COPY packages/workers ./packages/workers
RUN pnpm install --prod --frozen-lockfile
WORKDIR /app/packages/shared
RUN pnpm build
WORKDIR /app/packages/workers
RUN pnpm build
CMD ["node", "dist/index.js"]

# Stage 7: Production - Web
FROM node:20-alpine AS web
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared ./packages/shared
COPY packages/web ./packages/web
RUN pnpm install --prod --frozen-lockfile
WORKDIR /app/packages/shared
RUN pnpm build
WORKDIR /app/packages/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build
EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]
