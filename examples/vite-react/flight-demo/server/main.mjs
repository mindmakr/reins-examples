// Payday Invoice Studio, production server with flight on.
//
// It serves the browser build (built and checked with `reins verify` in the Docker image), a payout API against
// the simulated bank, a health address for the watcher, and the flight report page behind the app's own admin
// check. It imports @mindmakr/reins/flight only: no development reins, no pairing, no actions.

import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { flight, renderFlightHtml } from '@mindmakr/reins/flight';
import config from '../flight.config.mjs';
import { createBank, parseBankScript } from './bank.mjs';
import { createPayouts } from './payouts.mjs';

const PORT = Number(process.env.PORT || 4100);
const PUBLIC_DIR = resolve(process.env.PUBLIC_DIR || 'public');
// Demo only: the admin token guards the report page. Set DEMO_ADMIN_TOKEN to your own value outside the demo.
const ADMIN_TOKEN = process.env.DEMO_ADMIN_TOKEN || 'demo-only-admin-token';

flight.start({
  ...config,
  routes: ['/api/payouts', '/api/payouts/:id', '/admin/flight', '/admin/flight.json', '/health'],
});

const step = (key, name) => flight.step('payout', key, name);

let payouts;
const bank = createBank({
  script: parseBankScript(process.env.BANK_SCRIPT),
  onConfirm: (transferId, status) => payouts.onConfirm(transferId, status),
});
payouts = createPayouts({ mode: process.env.PAYOUT_MODE || 'broken', bank, step });

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon' };

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
}

function isAdmin(req) {
  const got = Buffer.from(String(req.headers.authorization || ''));
  const want = Buffer.from(`Bearer ${ADMIN_TOKEN}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

async function readJson(req, max = 1024) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > max) throw Object.assign(new Error('body too large'), { status: 413 });
    chunks.push(c);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw Object.assign(new Error('body is not JSON'), { status: 400 });
  }
}

async function serveStatic(pathname, res) {
  const rel = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, '');
  let file = join(PUBLIC_DIR, rel || 'index.html');
  if (file !== PUBLIC_DIR && !file.startsWith(PUBLIC_DIR + sep)) return send(res, 404, { ok: false, error: 'Not found' });
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
  } catch {
    file = join(PUBLIC_DIR, 'index.html'); // the single-page app handles its own paths
  }
  try {
    send(res, 200, await readFile(file), TYPES[extname(file)] || 'application/octet-stream');
  } catch {
    send(res, 404, { ok: false, error: 'Not found' });
  }
}

async function handle(req, res) {
  const { pathname } = new URL(req.url || '/', 'http://localhost');

  if (pathname === '/health') return send(res, 200, { ok: true });

  if (pathname === '/api/payouts' && req.method === 'POST') {
    const body = await readJson(req);
    const amountCents = Number(body.amountCents);
    if (!Number.isInteger(amountCents) || amountCents <= 0 || amountCents > 10_000_000) {
      return send(res, 400, { ok: false, error: 'amountCents must be a whole number from 1 to 10,000,000' });
    }
    return send(res, 201, { ok: true, ...(await payouts.create(amountCents)) });
  }

  if (pathname === '/api/payouts' && req.method === 'GET') {
    return send(res, 200, { ok: true, mode: payouts.mode, payouts: payouts.list(), ledgerTotalCents: payouts.ledgerTotalCents() });
  }

  const one = pathname.match(/^\/api\/payouts\/([A-Za-z0-9-]{1,40})$/);
  if (one && req.method === 'GET') {
    const p = payouts.get(one[1]);
    return p ? send(res, 200, { ok: true, payout: p }) : send(res, 404, { ok: false, error: 'Not found' });
  }

  // The flight report: the app's own page behind its own admin check. Flight ships no route.
  if (pathname === '/admin/flight' || pathname === '/admin/flight.json') {
    if (!isAdmin(req)) return send(res, 401, { ok: false, error: 'Sign in as an admin' });
    const report = await flight.report();
    if (!report) return send(res, 503, 'Flight is off.', 'text/plain; charset=utf-8');
    return pathname.endsWith('.json') ? send(res, 200, report) : send(res, 200, renderFlightHtml(report), 'text/html; charset=utf-8');
  }

  if (pathname.startsWith('/api/')) return send(res, 404, { ok: false, error: 'Not found' });
  if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(pathname, res);
  return send(res, 405, { ok: false, error: 'Method not allowed' });
}

const server = createServer(
  flight.wrapHandler((req, res) => {
    handle(req, res).catch((err) => {
      if (!res.headersSent) send(res, err?.status || 500, { ok: false, error: err?.status ? err.message : 'Internal error' });
    });
  }),
);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[payday-flight] listening on port ${PORT}, NODE_ENV=${process.env.NODE_ENV}, payout mode ${payouts.mode}, flight on`);
});

let stopping = false;
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    if (stopping) process.exit(1);
    stopping = true;
    server.close();
    flight.stop();
    // Wait until queued steps are written and the checker lock is given back, then leave.
    Promise.race([flight.closed(), new Promise((r) => setTimeout(r, 8000))]).finally(() => process.exit(0));
  });
}
