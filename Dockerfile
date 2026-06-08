# ─────────────────────────────────────────────────────────────
# Stage 1 — build the React (Vite) app into /app/dist
# ─────────────────────────────────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app

# Build tools needed for native deps (better-sqlite3 is in the dep tree)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
# Use the lockfile when present (reproducible); fall back to install if it was
# git-ignored on the deploy host.
RUN npm ci || npm install

# Frontend sources + entries + config
COPY tsconfig.json vite.config.ts index.html login.html ./
COPY app/ ./app/
COPY public/ ./public/

RUN npm run build   # -> /app/dist

# ─────────────────────────────────────────────────────────────
# Stage 2 — runtime image (backend + built dist only)
# ─────────────────────────────────────────────────────────────
FROM node:20-slim AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Backend code + built frontend
COPY server.js ./
COPY src/ ./src/
COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/data /app/logs

# Run as non-root user for security
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 3344

CMD ["node", "server.js"]
