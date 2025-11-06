# Multi-stage build for smaller final image
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S quipexport -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy documentation
COPY README.md LICENSE CHANGELOG.md ./
COPY docs ./docs

# Create directories for exports and logs
RUN mkdir -p /exports /app/logs && \
    chown -R quipexport:nodejs /app /exports

# Switch to non-root user
USER quipexport

# Set environment variables
ENV NODE_ENV=production
ENV QUIP_OUTPUT_DIR=/exports

# Expose volume for exports
VOLUME ["/exports"]

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node dist/cli/index.js --version || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Default command
CMD ["node", "dist/cli/index.js", "--help"]