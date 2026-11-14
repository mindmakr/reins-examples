# syntax=docker/dockerfile:1
# The Payday Invoice Studio flight demo. Build context: examples/vite-react (see compose.yaml).
# Both stages install @mindmakr/reins 0.2.0 from npm with `npm ci`, from the demo's own package-lock.json.

# 1. The browser build of the example, made with reins 0.2.0 and checked with `reins verify`.
FROM node:22-slim AS web
WORKDIR /web
# The demo's package.json lists what the example's browser build needs (vite, its React plugin, React) as
# devDependencies, so this stage installs from the same lockfile as the server, with no test or agent tools.
COPY flight-demo/package.json flight-demo/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
COPY server ./server
# The production build swaps @mindmakr/reins for its empty stub; reins verify fails this build if any
# development reins code is left in dist.
RUN npx vite build && npx reins verify dist

# 2. The production server: NODE_ENV=production, flight on, the browser build served from ./public.
FROM node:22-slim AS app
ENV NODE_ENV=production
WORKDIR /app
COPY flight-demo/package.json flight-demo/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY flight-demo/reins.flight.json flight-demo/flight.config.mjs ./
COPY flight-demo/server ./server
COPY flight-demo/receiver ./receiver
COPY --from=web /web/dist ./public
RUN mkdir -p /data/flight && chown -R node:node /data
USER node
EXPOSE 4100
CMD ["node", "server/main.mjs"]
