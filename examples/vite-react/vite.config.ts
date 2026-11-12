import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import reins from '@mindmakr/reins/vite';
import { nodeEnabled } from '@mindmakr/reins/node';
// @ts-expect-error ESM server module
import { createInvoiceApi } from './server/index.mjs';

/**
 * Mounts the Payday Invoice API (`server/index.mjs`, instrumented with `@mindmakr/reins/node`)
 * directly into Vite's dev server so `npm run dev` runs both frontend and backend in one command.
 *
 * - Pairs with the local `reins` bridge as a `node` server (`reins_server`).
 * - Joins browser `fetch('/api/...')` calls with server `db.*` spans via `x-reins-trace`.
 * - Sends `Server-Timing` headers so `<ReinsPanel id="perf-hud">` displays live backend DB latency.
 */
function invoiceApiMiddleware(): Plugin {
  return {
    name: 'payday-invoice-api',
    configureServer(server) {
      const api = createInvoiceApi();
      if (nodeEnabled()) {
        void api.reinsNode.connect({
          tokenFile: join(server.config.root, '.reins', 'token'),
          meta: { name: 'payday-api', service: 'invoices' },
        });
        server.httpServer?.once('close', () => {
          api.reinsNode.disconnect();
        });
      }
      server.middlewares.use(api.middleware);
    },
  };
}

export default defineConfig({
  plugins: [reins(), invoiceApiMiddleware(), react()],
  resolve: {
    dedupe: ['@mindmakr/reins', 'react', 'react-dom'],
  },
  optimizeDeps: {
    exclude: ['@mindmakr/reins', '@mindmakr/reins/react', '@mindmakr/reins/adapters', '@mindmakr/reins/record', '@mindmakr/reins/report'],
    // `@mindmakr/reins/react` is excluded above and imports React, so Vite would only find React while the page is
    // already running and then reload it. Naming React here pre-bundles it at start, even on a cold cache.
    include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
  },
  server: {
    watch: {
      ignored: ['**/.reins/**', '**/screenshots/**'],
    },
  },
});
