# Builds the whole app into one container:
#   1) build the PWA frontend  ->  static files
#   2) install the backend (with native modules) and copy the frontend in
#
# You don't need to understand this file — Docker runs it for you.

# ---------- Stage 1: build the frontend ----------
FROM node:20-bookworm-slim AS web
WORKDIR /web
COPY web/package*.json ./
RUN npm install
COPY web/ ./
RUN npm run build      # outputs /web/dist

# ---------- Stage 2: backend + final image ----------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Build tools for native modules (better-sqlite3, sharp) + ffmpeg for video thumbnails.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ffmpeg \
 && rm -rf /var/lib/apt/lists/*

COPY api/package*.json ./
RUN npm install --omit=dev

# Backend source (run directly with tsx — no separate build step).
COPY api/ ./
# The built frontend, served as static files by the backend.
COPY --from=web /web/dist ./public

EXPOSE 3000
CMD ["npm", "run", "start"]
