# syntax=docker/dockerfile:1
# Multi-stage build for the amazon-scraper-api-mcp stdio MCP server.
# Stage 1 compiles TypeScript to dist/.
# Stage 2 ships a slim runtime with only production deps + compiled output.

FROM node:20-slim AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist

# stdio MCP server. No port to expose.
# Glama / MCP clients communicate via JSON-RPC on stdin/stdout.
ENTRYPOINT ["node", "dist/index.js"]
