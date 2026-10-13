# Production image: builds the React dashboard and serves it from the Node backend.

# ---- Stage 1: build frontend ----
FROM node:18-alpine AS frontend
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: backend + built frontend ----
FROM node:18-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/ ./
COPY --from=frontend /frontend/build ./public
ENV NODE_ENV=production PORT=5000
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
CMD ["node", "server.js"]
