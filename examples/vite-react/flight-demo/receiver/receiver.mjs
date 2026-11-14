// A local webhook receiver for the flight demo, in plain Node with no reins code: what any team's receiver does.
// It checks each delivery as a Standard Webhook (https://www.standardwebhooks.com/), the way SECURITY.md in
// mindmakr/reins describes:
//   - the HMAC-SHA256 of `<webhook-id>.<webhook-timestamp>.<raw body>`, compared in constant time
//   - a timestamp no more than 5 minutes from this clock, so a captured delivery cannot be replayed later
//   - a webhook-id seen before is dropped
// It prints each finding's plain text and keeps the checked messages for the demo runner (GET /received).
// A real receiver listens on https; this one runs only beside the server, inside the demo's Docker network.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';

const PORT = Number(process.env.RECEIVER_PORT || 8787);
// Demo only: set FLIGHT_WEBHOOK_SECRET to your own secret (24 to 64 bytes) outside the demo.
const SECRET = process.env.FLIGHT_WEBHOOK_SECRET || 'demo-only-webhook-secret-change-me';
const KEY = SECRET.startsWith('whsec_') ? Buffer.from(SECRET.slice(6), 'base64') : Buffer.from(SECRET, 'utf8');
const TOLERANCE_S = 5 * 60;
const MAX_BODY = 64 * 1024;

const seen = new Set();
const MAX_RECEIVED = 200; // keep the last 200 messages so a long run cannot grow the list without limit
const received = [];
let rejected = 0;

function verify(headers, raw) {
  const id = headers['webhook-id'];
  const ts = headers['webhook-timestamp'];
  const sig = headers['webhook-signature'];
  if (typeof id !== 'string' || typeof ts !== 'string' || typeof sig !== 'string') return 'missing webhook headers';
  if (!/^\d{1,12}$/.test(ts) || Math.abs(Date.now() / 1000 - Number(ts)) > TOLERANCE_S) return 'timestamp too old or too new';
  const want = createHmac('sha256', KEY).update(`${id}.${ts}.`).update(raw).digest();
  const ok = sig.split(' ').some((part) => {
    const [version, b64] = part.split(',', 2);
    if (version !== 'v1' || !b64) return false;
    const got = Buffer.from(b64, 'base64');
    return got.length === want.length && timingSafeEqual(got, want);
  });
  if (!ok) return 'bad signature';
  if (seen.has(id)) return 'already seen';
  seen.add(id);
  if (seen.size > 10_000) seen.delete(seen.values().next().value);
  return null;
}

const server = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end('{"ok":true}');
  }
  if (req.method === 'GET' && req.url === '/received') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ received, rejected }));
  }
  if (req.method !== 'POST' || req.url !== '/flight') {
    res.writeHead(404);
    return res.end();
  }
  const chunks = [];
  let size = 0;
  req.on('data', (c) => {
    size += c.length;
    if (size > MAX_BODY) req.destroy();
    else chunks.push(c);
  });
  req.on('end', () => {
    const raw = Buffer.concat(chunks);
    const problem = verify(req.headers, raw);
    if (problem) {
      rejected += 1;
      console.log(`[receiver] refused a delivery: ${problem}`);
      res.writeHead(problem === 'already seen' ? 200 : 401);
      return res.end();
    }
    let body;
    try {
      body = JSON.parse(raw.toString('utf8'));
    } catch {
      rejected += 1;
      res.writeHead(400);
      return res.end();
    }
    received.push({ receivedAt: new Date().toISOString(), id: req.headers['webhook-id'], verified: true, body });
    if (received.length > MAX_RECEIVED) received.splice(0, received.length - MAX_RECEIVED);
    console.log(`[receiver] ${body.type}: ${body.text}`);
    res.writeHead(204);
    res.end();
  });
});

server.listen(PORT, '0.0.0.0', () => console.log(`[receiver] checking signed flight webhooks on port ${PORT}`));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => process.exit(0));
