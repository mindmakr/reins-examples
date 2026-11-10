import { createServer } from 'node:http';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReinsNode, nodeEnabled } from 'reins/node';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Payday Invoice Studio — Dev API Server instrumented with `reins/node`.
 *
 * Demonstrates:
 *  1. Inbound HTTP tracking + `Server-Timing` response headers (`app`, `db`, `el-p99`) for the frontend HUD.
 *  2. Named database spans (`reinsNode.span('db.*')`) via Node `AsyncLocalStorage`.
 *  3. Trace correlation (`x-reins-trace`) joining browser `fetch('/api/...')` calls with server DB spans in `reins_perf` and `reins_report`.
 *  4. Server-registered actions (`set-db-query-mode`, `get-db-query-mode`, `reset-server-metrics`) callable via `reins_run_action`.
 *  5. A toggleable N+1 slow query (`n+1-slow`, ~560ms with 5 per-invoice `db.line_items.select` queries) vs batched query (`batched-fast`, ~18ms)
 *     so `reins_report` and `npx reins report --compare` showcase real backend diagnosis and regression diffs.
 */
export function createInvoiceApi(options = {}) {
  const env = options.env ?? process.env;
  const rn = options.reinsNode ?? createReinsNode(env);
  /** @type {'n+1-slow' | 'batched-fast'} */
  let queryMode = options.initialQueryMode ?? 'n+1-slow';

  rn.action({
    name: 'get-db-query-mode',
    description: 'Inspect whether /api/invoices uses the unbatched N+1 query (n+1-slow) or batched IN (...) query (batched-fast)',
    readOnly: true,
    run: () => ({ queryMode }),
  });

  rn.action({
    name: 'set-db-query-mode',
    description: 'Switch /api/invoices between the N+1 slow query (n+1-slow) and the batched query fix (batched-fast)',
    input: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['n+1-slow', 'batched-fast'] },
      },
      required: ['mode'],
    },
    run: ({ mode }) => {
      if (mode !== 'n+1-slow' && mode !== 'batched-fast') {
        throw new Error(`Unsupported mode: ${mode}`);
      }
      queryMode = mode;
      return { queryMode };
    },
  });

  rn.action({
    name: 'reset-server-metrics',
    description: 'Clear recorded server request/span ring buffers before capturing a fresh post-fix session report',
    run: () => {
      rn.clear();
      return { cleared: true, queryMode };
    },
  });

  async function routeApi(req, res) {
    const sendJson = (status, payload) => {
      res.writeHead(status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify(payload));
    };

    const rawUrl = req.url || '/';
    const pathname = rawUrl.split('?')[0];

    if (req.method === 'POST' && pathname === '/api/session/login') {
      await rn.span('db.users.find_by_email', () => sleep(8));
      await rn.span('db.sessions.insert', () => sleep(6));
      return sendJson(200, {
        ok: true,
        authenticated: true,
        issuedAt: new Date().toISOString(),
      });
    }

    if (req.method === 'GET' && pathname === '/api/invoices') {
      if (queryMode === 'n+1-slow') {
        // Deliberate N+1 anti-pattern: 1 query for 5 invoices + 5 sequential queries for line items (~565ms total)
        await rn.span('db.invoices.select', () => sleep(35));
        for (let i = 0; i < 5; i++) {
          await rn.span('db.line_items.select', () => sleep(106));
        }
      } else {
        // Batched fix: 1 query for invoices + 1 WHERE invoice_id IN (...) query (~16ms total)
        await rn.span('db.invoices.select', () => sleep(8));
        await rn.span('db.line_items.select_batch', () => sleep(8));
      }
      return sendJson(200, {
        ok: true,
        queryMode,
        syncedAt: new Date().toISOString(),
        source: 'payday-dev-api',
      });
    }

    const payMatch = pathname.match(/^\/api\/invoices\/([A-Za-z0-9-]+)\/pay$/);
    if (req.method === 'POST' && payMatch) {
      await rn.span('db.invoices.update_paid', () => sleep(9));
      await rn.span('db.ledger.insert_entry', () => sleep(6));
      return sendJson(200, {
        ok: true,
        id: payMatch[1],
        status: 'paid',
        paidAt: new Date().toISOString(),
      });
    }

    if (req.method === 'POST' && pathname === '/api/invoices/void-overdue') {
      await rn.span('db.invoices.void_overdue', () => sleep(11));
      return sendJson(200, {
        ok: true,
        voidedAt: new Date().toISOString(),
      });
    }

    return sendJson(404, { ok: false, error: 'Not found' });
  }

  const trackMiddleware = rn.middleware({ serverTiming: true });

  /** Connect/Vite middleware that instruments and serves `/api/*` requests. */
  function middleware(req, res, next) {
    if (!req.url?.startsWith('/api/')) return next();
    trackMiddleware(req, res, () => {
      routeApi(req, res).catch((err) => {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: err?.message || 'Internal error' }));
      });
    });
  }

  /** Standalone Node `http.createServer` request handler wrapped with `reinsNode.wrapHandler`. */
  const handler = rn.wrapHandler(
    (req, res) => {
      if (!req.url?.startsWith('/api/')) {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }
      void routeApi(req, res);
    },
    { serverTiming: true },
  );

  return {
    reinsNode: rn,
    middleware,
    handler,
    getQueryMode: () => queryMode,
    setQueryMode: (mode) => {
      queryMode = mode;
    },
  };
}

// Allow running as a standalone Node API server: `node server/index.mjs`
const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const port = Number(process.env.API_PORT || 4010);
  const api = createInvoiceApi();
  if (nodeEnabled()) {
    void api.reinsNode.connect({
      tokenFile: join(projectRoot, '.reins', 'token'),
      meta: { name: 'payday-api', service: 'invoices' },
    });
  }
  const srv = createServer(api.handler);
  srv.listen(port, '127.0.0.1', () => {
    console.log(`[payday-api] listening on http://127.0.0.1:${port} (reins/node instrumentation active)`);
  });
}
