// One command for the whole flight demo: `npm run demo` (or `node scripts/run-demo.mjs`) in this folder.
//
//  1. Copies the local build of reins (REINS_TARBALL) to vendor/ and builds the Docker image from it; the image
//     build also makes the browser build and fails if `reins verify` finds development reins in it.
//  2. Checks reins.flight.json with `reins flight check`.
//  3. Broken mode: starts the server (production build, flight on), the watcher and the webhook receiver, pays
//     five payouts, and waits until flight reports the pending payout and the double debit to the receiver.
//     Saves the report page (HTML), its data (JSON) and Markdown, and runs `reins verify` on the served build.
//  4. Fixed mode, on a fresh store: the same five payouts; no promise is broken.
//  5. `reins flight report --compare` the two reports: both findings resolved, none new.
//  6. Brings everything down, also when a step fails, and exits 1 when any step failed.
//
// Everything it saves goes to out/ (git-ignored): the reports hold payout ids, which are server-side data.

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const demoDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(demoDir, '..', '..', '..');
const outDir = join(demoDir, 'out');
const PROJECT = process.env.DEMO_PROJECT || 'reins-flight-demo';
// Demo only, as in compose.yaml.
const ADMIN_TOKEN = process.env.DEMO_ADMIN_TOKEN || 'demo-only-admin-token';
const KEYS = { pending: 'promise:payout:pending-settles', debit: 'promise:payout:one-debit' };
const AMOUNTS = [125_000, 98_000, 143_500, 110_250, 87_600]; // five employees' pay, in cents
const WITHIN_MS = 15_000; // pending-settles in reins.flight.json

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [];
let stepNo = 0;

function log(line) {
  console.log(line);
}

/** Runs a named step; a failure is recorded and stops the demo. */
async function step(name, fn) {
  stepNo += 1;
  const started = Date.now();
  try {
    const note = await fn();
    log(`ok   ${String(stepNo).padStart(2)}. ${name}${note ? ` (${note})` : ''} [${((Date.now() - started) / 1000).toFixed(1)} s]`);
  } catch (err) {
    failures.push(name);
    log(`FAIL ${String(stepNo).padStart(2)}. ${name}: ${err?.message || err}`);
    throw err;
  }
}

function freePort() {
  return new Promise((ok, fail) => {
    const probe = createServer();
    probe.once('error', fail);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => ok(port));
    });
  });
}

let env = { ...process.env, COMPOSE_PROJECT_NAME: PROJECT }; // compose.yaml tags the image by this name

/** Runs docker compose for this project; throws with the tail of its output when it fails, unless `allowFail`. */
function compose(args, { allowFail = false, input } = {}) {
  const r = spawnSync('docker', ['compose', '-p', PROJECT, '-f', join(demoDir, 'compose.yaml'), ...args], {
    cwd: demoDir,
    env,
    encoding: 'utf8',
    input,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error) throw new Error(`docker could not run (${r.error.code || r.error.message}). Is Docker running?`);
  if (r.status !== 0 && !allowFail) {
    const tail = `${r.stdout || ''}${r.stderr || ''}`.trim().split('\n').slice(-12).join('\n');
    throw new Error(`docker compose ${args[0]} exited ${r.status}\n${tail}`);
  }
  return r;
}

/** The reins CLI inside the running server container. */
function reinsInServer(args, opts) {
  return compose(['exec', '-T', 'server', 'node_modules/.bin/reins', ...args], opts);
}

async function http(path, { method = 'GET', body, admin = false, port } = {}) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(admin ? { Authorization: `Bearer ${ADMIN_TOKEN}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`${method} ${path} answered ${res.status}`);
  return (res.headers.get('content-type') || '').includes('json') ? res.json() : res.text();
}

async function waitFor(what, fn, timeoutMs, everyMs = 1000) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeoutMs) {
    try {
      last = await fn();
      if (last) return last;
    } catch (err) {
      last = err;
    }
    await sleep(everyMs);
  }
  throw new Error(`timed out after ${timeoutMs / 1000} s waiting for ${what}${last instanceof Error ? ` (last: ${last.message})` : ''}`);
}

const opened = (received, key) => received.filter((m) => m.body?.type === 'opened' && m.body?.finding?.key === key);

/** One mode: start on a fresh store, pay the payouts, collect the receiver's messages and the report. */
async function runMode(mode, ports) {
  env = { ...env, PAYOUT_MODE: mode };
  const api = (path, o = {}) => http(path, { ...o, port: ports.server });
  const receiver = () => http('/received', { port: ports.receiver });

  await step(`${mode}: start server (NODE_ENV=production, flight on), watcher and receiver on a fresh store`, async () => {
    compose(['down', '-v', '--remove-orphans'], { allowFail: true });
    compose(['up', '-d', '--wait', '--wait-timeout', '90']);
    // Docker Desktop can take a moment to forward a published port after the containers are healthy.
    const status = await waitFor('the server on its published port', () => api('/api/payouts'), 20_000, 500);
    if (status.mode !== mode) throw new Error(`server runs in ${status.mode} mode, not ${mode}`);
    return `server http://127.0.0.1:${ports.server}, receiver http://127.0.0.1:${ports.receiver}`;
  });

  const ids = [];
  await step(`${mode}: pay ${AMOUNTS.length} payouts through the simulated bank`, async () => {
    for (const amountCents of AMOUNTS) ids.push((await api('/api/payouts', { method: 'POST', body: { amountCents } })).id);
    return ids.join(', ');
  });

  if (mode === 'broken') {
    await step('broken: flight tells the webhook receiver about the pending payout and the double debit', async () => {
      const got = await waitFor('both findings at the receiver', async () => {
        const r = await receiver();
        return opened(r.received, KEYS.pending).length && opened(r.received, KEYS.debit).length ? r : null;
      }, 90_000);
      if (got.rejected) throw new Error(`the receiver refused ${got.rejected} delivery(s)`);
      writeFileSync(join(outDir, 'broken-received.json'), JSON.stringify(got, null, 2));
      return [KEYS.pending, KEYS.debit].map((k) => `"${opened(got.received, k)[0].body.text}"`).join(' | ');
    });

    await step('broken: the receiver refuses a delivery with a wrong signature', async () => {
      const res = await fetch(`http://127.0.0.1:${ports.receiver}/flight`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'webhook-id': 'msg_forged',
          'webhook-timestamp': String(Math.floor(Date.now() / 1000)),
          'webhook-signature': `v1,${Buffer.alloc(32).toString('base64')}`,
        },
        body: JSON.stringify({ type: 'opened', text: 'forged' }),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.status !== 401) throw new Error(`the receiver answered ${res.status}, not 401`);
      const r = await receiver();
      if (r.received.some((m) => m.body?.text === 'forged')) throw new Error('the receiver kept the forged delivery');
      return 'answered 401 and kept nothing';
    });
  } else {
    await step('fixed: every payout is paid exactly once, the pending one after the code asked the bank', async () => {
      const done = await waitFor('all payouts paid', async () => {
        const s = await api('/api/payouts');
        return s.payouts.length === AMOUNTS.length && s.payouts.every((p) => p.status === 'paid') ? s : null;
      }, 30_000);
      const twice = done.payouts.filter((p) => p.debits !== 1);
      if (twice.length) throw new Error(`payouts debited other than once: ${twice.map((p) => `${p.id} x${p.debits}`).join(', ')}`);
      // Let the pending-settles window and a few checker passes go by, so a broken promise would show.
      await sleep(WITHIN_MS + 6_000);
      return `ledger total ${done.ledgerTotalCents} cents = sum of the payouts ${AMOUNTS.reduce((a, b) => a + b, 0)}`;
    });
  }

  let report;
  await step(`${mode}: save the report page (HTML), its data (JSON) and Markdown from the server`, async () => {
    report = await waitFor('a report with the expected findings', async () => {
      const r = await api('/admin/flight.json', { admin: true });
      const keys = new Set(r.findings.map((f) => f.key));
      if (mode === 'broken') return keys.has(KEYS.pending) && keys.has(KEYS.debit) ? r : null;
      return r;
    }, 30_000);
    const html = await api('/admin/flight', { admin: true });
    writeFileSync(join(outDir, `${mode}-report.json`), JSON.stringify(report, null, 2));
    writeFileSync(join(outDir, `${mode}-report.html`), html);
    compose(['cp', join(outDir, `${mode}-report.json`), `server:/tmp/${mode}-report.json`]);
    const md = reinsInServer(['flight', 'report', `/tmp/${mode}-report.json`]).stdout;
    writeFileSync(join(outDir, `${mode}-report.md`), md);
    if (!/Development instruments are off/.test(html)) throw new Error('the report page does not say that development instruments are off');
    if (mode === 'broken') {
      for (const key of [KEYS.pending, KEYS.debit]) {
        const f = report.findings.find((x) => x.key === key);
        if (!html.includes(escapeHtml(f.text))) throw new Error(`the report page does not show the finding ${key}`);
      }
    }
    const open = report.findings.map((f) => `${f.key} (${f.level})`).join(', ') || 'none';
    return `open findings: ${open}`;
  });

  if (mode === 'fixed') {
    await step('fixed: no finding is open and the receiver was told of no broken promise', async () => {
      if (report.findings.length) throw new Error(`open findings: ${report.findings.map((f) => `${f.key} (${f.kind})`).join(', ')}`);
      const r = await receiver();
      writeFileSync(join(outDir, 'fixed-received.json'), JSON.stringify(r, null, 2));
      const told = r.received.filter((m) => m.body?.type === 'opened' && m.body?.finding?.kind === 'broken');
      if (told.length) throw new Error(`the receiver was told of: ${told.map((m) => m.body.finding.key).join(', ')}`);
      const held = (report.promises || []).filter((p) => p.state === 'held').map((p) => p.id);
      return `promises held: ${held.join(', ') || 'none listed'}; messages at the receiver: ${r.received.length}`;
    });
  } else {
    await step('broken: reins verify passes on the browser build the production server serves', async () => {
      const r = reinsInServer(['verify', 'public'], { allowFail: true });
      writeFileSync(join(outDir, 'verify.log'), `$ reins verify public  (in the server container)\nexit ${r.status}\n${r.stdout}${r.stderr}`);
      if (r.status !== 0) throw new Error(`reins verify exited ${r.status}: ${(r.stdout + r.stderr).trim().split('\n').slice(-3).join(' ')}`);
      return (r.stdout + r.stderr).trim().split('\n').slice(-1)[0];
    });
  }

  writeFileSync(join(outDir, `${mode}-compose.log`), compose(['logs', '--no-color', '--timestamps'], { allowFail: true }).stdout || '');
  return report;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function main() {
  log('reins flight demo: Payday Invoice Studio payouts, broken then fixed\n');
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  await step('use the local build of reins (REINS_TARBALL)', async () => {
    const tarball = resolve(process.env.REINS_TARBALL || join(repoRoot, '..', 'reins', 'packages', 'reins', 'mindmakr-reins-0.2.0.tgz'));
    if (!existsSync(tarball) || !statSync(tarball).isFile()) {
      throw new Error(
        `no reins tarball at ${tarball}.\n` +
          '     Build one from a checkout of mindmakr/reins with flight (0.2.0 or later):\n' +
          '       npm ci && npm run build            (at the reins repo root)\n' +
          '       cd packages/reins && npm pack      (makes mindmakr-reins-0.2.0.tgz)\n' +
          '     then set REINS_TARBALL to its path, or keep the reins checkout next to this repo.',
      );
    }
    mkdirSync(join(demoDir, 'vendor'), { recursive: true });
    copyFileSync(tarball, join(demoDir, 'vendor', 'mindmakr-reins.tgz'));
    return tarball;
  });

  await step('Docker is available', async () => {
    const r = spawnSync('docker', ['compose', 'version'], { encoding: 'utf8' });
    if (r.error || r.status !== 0) throw new Error('docker compose is not available. Install and start Docker.');
    return r.stdout.trim();
  });

  const ports = { server: Number(process.env.DEMO_PORT) || (await freePort()), receiver: Number(process.env.RECEIVER_PORT) || (await freePort()) };
  env = { ...env, DEMO_PORT: String(ports.server), RECEIVER_PORT: String(ports.receiver) };

  await step('build the image: browser build with reins verify, production server with flight', async () => {
    compose(['down', '-v', '--remove-orphans'], { allowFail: true });
    const r = compose(['build', '--progress', 'plain', 'server'], { allowFail: true });
    writeFileSync(join(outDir, 'build.log'), `${r.stdout || ''}${r.stderr || ''}`);
    if (r.status !== 0) throw new Error(`docker compose build exited ${r.status}; see out/build.log`);
    const verified = `${r.stdout}${r.stderr}`.split('\n').find((l) => /reins-verify-bundle: clean/.test(l));
    return verified ? verified.replace(/^#\d+\s+[\d.]+\s*/, '').trim() : 'built from the Docker cache, where reins verify passed before';
  });

  await step('reins flight check accepts reins.flight.json', async () => {
    const r = compose(['run', '--rm', '--no-deps', '-T', 'server', 'node_modules/.bin/reins', 'flight', 'check', 'reins.flight.json'], { allowFail: true });
    writeFileSync(join(outDir, 'check.log'), `$ reins flight check reins.flight.json\nexit ${r.status}\n${r.stdout}${r.stderr}`);
    if (r.status !== 0) throw new Error(`reins flight check exited ${r.status}: ${(r.stdout + r.stderr).trim()}`);
    return (r.stdout + r.stderr).trim().split('\n')[0];
  });

  await runMode('broken', ports);
  await runMode('fixed', ports);

  await step('reins flight report --compare: both findings resolved, none new', async () => {
    compose(['cp', join(outDir, 'broken-report.json'), 'server:/tmp/before.json']);
    compose(['cp', join(outDir, 'fixed-report.json'), 'server:/tmp/after.json']);
    const md = reinsInServer(['flight', 'report', '--compare', '/tmp/before.json', '/tmp/after.json']).stdout;
    const data = JSON.parse(reinsInServer(['flight', 'report', '--compare', '/tmp/before.json', '/tmp/after.json', '--json']).stdout);
    writeFileSync(join(outDir, 'compare.md'), md);
    writeFileSync(join(outDir, 'compare.json'), JSON.stringify(data, null, 2));
    log(md.trim().replace(/^/gm, '       '));
    const resolvedKeys = (data.resolved || []).map((f) => f.key);
    const missing = Object.values(KEYS).filter((k) => !resolvedKeys.includes(k));
    if (missing.length) throw new Error(`not resolved: ${missing.join(', ')}`);
    // reins flight report --compare --json prints { resolved, new, still }.
    for (const field of ['resolved', 'new', 'still']) {
      if (!Array.isArray(data[field])) throw new Error(`the compare output has no "${field}" list (keys: ${Object.keys(data).join(', ')})`);
    }
    const newKeys = data.new.map((f) => f.key);
    const stillKeys = data.still.map((f) => f.key);
    if (newKeys.length) throw new Error(`new findings: ${newKeys.join(', ')}`);
    if (stillKeys.length) throw new Error(`findings still open: ${stillKeys.join(', ')}`);
    return `resolved ${resolvedKeys.length}, new ${newKeys.length}, still open ${stillKeys.length}`;
  });
}

let code = 0;
try {
  await main();
} catch {
  code = 1;
} finally {
  try {
    compose(['down', '-v', '--remove-orphans'], { allowFail: true });
    log('\nok       Docker Compose project brought down (containers and the flight volume removed)');
  } catch (err) {
    log(`\nFAIL     could not bring the Docker Compose project down: ${err?.message || err}`);
    code = 1;
  }
}
log(code === 0 ? `\nflight demo: PASS (${stepNo} steps). Saved: ${outDir}` : `\nflight demo: FAIL at: ${failures.join('; ') || 'start-up'}. Saved: ${outDir}`);
process.exit(code);
