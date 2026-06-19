# syntax=docker/dockerfile:1

# ===========================================
# Build Stage
# ===========================================
FROM node:lts-bookworm AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm build

# ===========================================
# Production Stage
# ===========================================
FROM node:lts-bookworm AS production

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Labels
LABEL maintainer="ai-web-chat"
LABEL description="AI Chat Web Application with WebSocket and MySQL"

# Copy package files and install production dependencies only
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile --prod

# Copy built application from builder
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/server ./server
COPY --from=builder --chown=node:node /app/src/lib ./src/lib

# Set environment to production
ENV NODE_ENV=production

# Expose ports
# Next.js: 3000
# WebSocket: 3003
EXPOSE 3000
EXPOSE 3003

# Environment variables with defaults
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV WS_PORT=3003
ENV NEXT_PUBLIC_WS_URL=wss://localhost:3003

# Set working directory for scripts
WORKDIR /app

# Switch to non-root user
USER node

# Health check for Next.js
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api || exit 1

# Start Next.js Server
CMD ["pnpm", "start"]
