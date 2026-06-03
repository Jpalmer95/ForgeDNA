FROM node:20-slim

# Enable pnpm via corepack
RUN corepack enable
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@latest

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
RUN pnpm install --no-frozen-lockfile

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
CMD ["sh", "-c", "cd /app/lib/db && npx drizzle-kit push --config ./drizzle.config.ts 2>&1 || true && cd /app && node artifacts/api-server/dist/index.cjs"]
