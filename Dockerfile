# syntax=docker/dockerfile:1

# ===========================================
# Build Stage
# ===========================================
FROM node:20-alpine AS builder

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
FROM node:20-alpine AS production

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Labels
LABEL maintainer="ai-web-chat"
LABEL description="AI Chat Web Application with WebSocket and MySQL"

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files and install production dependencies only
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile --prod

# Copy built application from builder
COPY --from=builder --chown=nodejs:nodejs /app/.next ./.next
COPY --from=builder --chown=nodejs:nodejs /app/public ./public
COPY --from=builder --chown=nodejs:nodejs /app/server ./server
COPY --from=builder --chown=nodejs:nodejs /app/src/lib ./src/lib

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
USER nodejs

# Health check for Next.js
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start both Next.js and WebSocket servers
# Using sh to run both processes
CMD ["sh", "-c", "pnpm build && pnpm start & pnpm ws"]