FROM oven/bun:1 AS base
WORKDIR /usr/src/app

# --- Installation stage ---
# Needs every workspace package.json to resolve the Bun workspace graph.
# Build context is the monorepo root (see docker-compose.yml).
FROM base AS install
RUN mkdir -p /temp/dev/apps/bot /temp/dev/apps/panel-server /temp/dev/apps/panel-client /temp/dev/packages/db /temp/dev/packages/cache /temp/dev/packages/games /temp/dev/packages/economy
COPY package.json bun.lock /temp/dev/
COPY apps/bot/package.json /temp/dev/apps/bot/package.json
COPY apps/panel-server/package.json /temp/dev/apps/panel-server/package.json
COPY apps/panel-client/package.json /temp/dev/apps/panel-client/package.json
COPY packages/db/package.json /temp/dev/packages/db/package.json
COPY packages/cache/package.json /temp/dev/packages/cache/package.json
COPY packages/games/package.json /temp/dev/packages/games/package.json
COPY packages/economy/package.json /temp/dev/packages/economy/package.json
RUN cd /temp/dev && bun install --frozen-lockfile

# Production installation (excluding devDependencies)
RUN mkdir -p /temp/prod/apps/bot /temp/prod/apps/panel-server /temp/prod/apps/panel-client /temp/prod/packages/db /temp/prod/packages/cache /temp/prod/packages/games /temp/prod/packages/economy
COPY package.json bun.lock /temp/prod/
COPY apps/bot/package.json /temp/prod/apps/bot/package.json
COPY apps/panel-server/package.json /temp/prod/apps/panel-server/package.json
COPY apps/panel-client/package.json /temp/prod/apps/panel-client/package.json
COPY packages/db/package.json /temp/prod/packages/db/package.json
COPY packages/cache/package.json /temp/prod/packages/cache/package.json
COPY packages/games/package.json /temp/prod/packages/games/package.json
COPY packages/economy/package.json /temp/prod/packages/economy/package.json
RUN cd /temp/prod && bun install --frozen-lockfile --production

# --- Build stage ---
FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

# --- Final stage ---
FROM base AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /usr/src/app/apps/bot ./apps/bot
COPY --from=install /temp/prod/apps/bot/node_modules ./apps/bot/node_modules
COPY --from=prerelease /usr/src/app/packages/db ./packages/db
COPY --from=install /temp/prod/packages/db/node_modules ./packages/db/node_modules
COPY --from=prerelease /usr/src/app/packages/cache ./packages/cache
COPY --from=install /temp/prod/packages/cache/node_modules ./packages/cache/node_modules
COPY --from=prerelease /usr/src/app/packages/games ./packages/games
COPY --from=prerelease /usr/src/app/packages/economy ./packages/economy
COPY --from=prerelease /usr/src/app/package.json .

# Set production environment
ENV NODE_ENV=production

# Run with non-root user `bun` for security
USER bun

WORKDIR /usr/src/app/apps/bot

# Bot entry point (bypasses the "start" script's cross-env, unneeded here
# since NODE_ENV is already set above and cross-env is a devDependency)
CMD ["bun", "src/index.ts"]


