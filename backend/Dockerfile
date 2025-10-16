# Multi-stage build for production optimization
FROM node:22-alpine as base

# Install security updates and curl for health checks
RUN apk update && apk add --no-cache curl

# Create app directory and non-root user
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && \
    adduser -S hiuser -u 1001

# Development stage
FROM base as development
COPY package*.json ./
RUN npm ci
COPY . .
USER hiuser
EXPOSE 3001
CMD ["npm", "run", "dev"]

# Build stage
FROM base as build
COPY package*.json ./
RUN npm ci --include=dev
COPY . .
RUN npm run build

# Production stage
FROM base as production

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application
COPY --from=build --chown=hiuser:nodejs /app/dist ./dist
COPY --chown=hiuser:nodejs . .

# Create logs directory
RUN mkdir -p logs && chown hiuser:nodejs logs

# Switch to non-root user
USER hiuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Expose port
EXPOSE 3001

# Start application
CMD ["npm", "start"]