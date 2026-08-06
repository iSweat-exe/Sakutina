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

# --- Build stage ---
# The build needs devDependencies (vite, tsc, tailwind), so it reuses the
# dev install above rather than a --production one.
FROM base AS build
COPY --from=install /temp/dev/node_modules node_modules
COPY --from=install /temp/dev/apps/panel-client/node_modules apps/panel-client/node_modules
COPY . .
WORKDIR /usr/src/app/apps/panel-client
RUN bun run build

# --- Final stage ---
# Ships only the static build output behind nginx; no Bun runtime needed.
FROM nginx:alpine AS release
COPY --from=build /usr/src/app/apps/panel-client/dist /usr/share/nginx/html
COPY apps/panel-client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
