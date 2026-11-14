# syntax=docker/dockerfile:1
# The Payday Invoice Studio flight demo. Build context: examples/vite-react (see compose.yaml).
# Both stages install reins from vendor/mindmakr-reins.tgz, the local build of reins that scripts/run-demo.mjs
# copies there from REINS_TARBALL. Once reins 0.2.0 is published, both can install it from npm instead.

# 1. The browser build of the example, made with the local reins build and checked with `reins verify`.
FROM node:22-slim AS web
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
WORKDIR /web
COPY flight-demo/vendor/mindmakr-reins.tgz /vendor/mindmakr-reins.tgz
COPY package.json tsconfig.json vite.config.ts index.html ./
# Only what the browser build needs: the example's own tests and agent demo tools are left out.
RUN npm pkg set "devDependencies.@mindmakr/reins=file:/vendor/mindmakr-reins.tgz" \
 && npm pkg delete devDependencies.playwright devDependencies.vitest \
 && npm install --no-audit --no-fund --no-package-lock
COPY src ./src
COPY server ./server
# The production build swaps @mindmakr/reins for its empty stub; reins verify fails this build if any
# development reins code is left in dist.
RUN npx vite build && npx reins verify dist

# 2. The production server: NODE_ENV=production, flight on, the browser build served from ./public.
FROM node:22-slim AS app
ENV NODE_ENV=production
WORKDIR /app
COPY flight-demo/vendor/mindmakr-reins.tgz ./vendor/mindmakr-reins.tgz
COPY flight-demo/package.json ./
RUN npm install --omit=dev --no-audit --no-fund --no-package-lock
COPY flight-demo/reins.flight.json flight-demo/flight.config.mjs ./
COPY flight-demo/server ./server
COPY flight-demo/receiver ./receiver
COPY --from=web /web/dist ./public
RUN mkdir -p /data/flight && chown -R node:node /data
USER node
EXPOSE 4100
CMD ["node", "server/main.mjs"]
