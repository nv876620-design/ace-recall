# Build stage
FROM node:22-bookworm-slim AS builder

# Install build dependencies for native node modules (tree-sitter, better-sqlite3)
RUN apt-get update && \
    apt-get install -y python3 make g++ git && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files and scripts
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
COPY scripts ./scripts

# Install dependencies including devDependencies (needed for compilation)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the project (compiles TypeScript to JavaScript in dist/)
RUN pnpm run build

# Runtime stage
FROM node:22-bookworm-slim

# Install runtime dependencies
RUN apt-get update && \
    apt-get install -y ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy built package files and node_modules from builder
COPY package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Create a workspace data directory with 777 permissions for indexing
RUN mkdir -p /data && chmod 777 /data
ENV CODERECALL_WORKSPACE=/data

# Expose port (Fly.io uses 8080, Hugging Face uses 7860)
EXPOSE 8080

# Run the server on port specified by PORT env var, or fallback to 8080
CMD ["sh", "-c", "node dist/index.js mcp-http --port ${PORT:-8080} --host 0.0.0.0"]
