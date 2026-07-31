FROM oven/bun:1 AS base
WORKDIR /usr/src/app

# --- Installation stage ---
FROM base AS install
# Copy lock files to leverage Docker layer caching
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

# Production installation (excluding devDependencies)
RUN mkdir -p /temp/prod
COPY package.json bun.lock /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

# --- Build stage ---
FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

# --- Final stage ---
FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /usr/src/app/src ./src
COPY --from=prerelease /usr/src/app/package.json .

# Set production environment
ENV NODE_ENV=production

# Run with non-root user `bun` for security
USER bun

# Bot entry point
CMD ["bun", "run", "start"]
