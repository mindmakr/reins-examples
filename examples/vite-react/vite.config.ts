import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import reins from 'reins/vite';

/**
 * Tiny in-memory dev API middleware so browser `fetch('/api/...')` calls hit a real
 * HTTP endpoint during local development and automated agent runs.
 * `reins_network` captures these requests and automatically redacts sensitive headers.
 */
function invoiceApiMiddleware(): Plugin {
  return {
    name: 'payday-invoice-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();

        const sendJson = (status: number, payload: unknown) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify(payload));
        };

        if (req.method === 'GET' && req.url.startsWith('/api/invoices')) {
          return sendJson(200, {
            ok: true,
            syncedAt: new Date().toISOString(),
            source: 'payday-dev-api',
          });
        }

        if (req.method === 'POST' && req.url === '/api/session/login') {
          return sendJson(200, {
            ok: true,
            authenticated: true,
            issuedAt: new Date().toISOString(),
          });
        }

        const payMatch = req.url.match(/^\/api\/invoices\/([A-Za-z0-9-]+)\/pay$/);
        if (req.method === 'POST' && payMatch) {
          return sendJson(200, {
            ok: true,
            id: payMatch[1],
            status: 'paid',
            paidAt: new Date().toISOString(),
          });
        }

        if (req.method === 'POST' && req.url === '/api/invoices/void-overdue') {
          return sendJson(200, {
            ok: true,
            voidedAt: new Date().toISOString(),
          });
        }

        return sendJson(404, { ok: false, error: 'Not found' });
      });
    },
  };
}

export default defineConfig({
  plugins: [reins(), invoiceApiMiddleware(), react()],
});
