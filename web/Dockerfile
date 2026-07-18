FROM node:20-slim

# Enable pnpm via corepack (already bundled in node:20-slim)
WORKDIR /app
ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# Copy workspace config first for better layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy all package.jsons for workspace resolution
COPY artifacts/forge-dna/package.json artifacts/forge-dna/
COPY artifacts/api-server/package.json artifacts/api-server/
COPY lib/api-zod/package.json lib/api-zod/
COPY lib/api-client-react/package.json lib/api-client-react/
COPY lib/db/package.json lib/db/
COPY lib/game-dna-schema/package.json lib/game-dna-schema/
COPY lib/replit-auth-web/package.json lib/replit-auth-web/

# Install all dependencies (including devDependencies for build)
RUN pnpm install --no-frozen-lockfile --ignore-scripts 2>&1 || true

# Copy all source
COPY . .

# Build frontend (outputs to artifacts/forge-dna/dist/public/)
RUN cd artifacts/forge-dna && pnpm run build

# Copy frontend build into api-server for static serving
RUN mkdir -p artifacts/api-server/dist/public && \
    cp -r artifacts/forge-dna/dist/public/* artifacts/api-server/dist/public/

# Build API server (esbuild bundle)
RUN cd artifacts/api-server && pnpm run build

# Expose port
ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000

# Start: push DB schema then run API server
COPY init-db.js /app/init-db.js
CMD ["sh", "-c", "node /app/init-db.js && node artifacts/api-server/dist/index.cjs"]
