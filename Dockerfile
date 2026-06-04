# Dockerfile
FROM node:20-slim

# Install build tools needed for better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency files first (layer cache optimization)
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy source code
COPY server.js ./
COPY public/ ./public/

# Create data directory for SQLite
RUN mkdir -p /app/data /app/logs

# Run as non-root user for security
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 3344

CMD ["node", "server.js"]
