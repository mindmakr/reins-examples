import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reins } from 'reins';
import { createReinsNode, TRACE_HEADER } from 'reins/node';
import { collectSession, startRecording, stopRecording } from 'reins/record';
import { buildSession, compareSessions, findings, renderMarkdown } from 'reins/report';
import { findMarker, listFiles } from 'reins/verify';
import { build } from 'vite';
import { beforeEach, describe, expect, it } from 'vitest';
// @ts-expect-error ESM server module
import { createInvoiceApi } from '../server/index.mjs';
import { parseServerTiming, store } from '../src/store';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

describe('Payday Invoice Studio (examples/vite-react)', () => {
  beforeEach(() => {
    store.resetForTests();
    stopRecording();
  });

  it('computes initial totals, parses Server-Timing, and updates state across actions', async () => {
    const initial = store.getSnapshot();
    expect(initial.locale).toBe('en');
    expect(initial.dir).toBe('ltr');
    expect(initial.totals).toEqual({
      outstandingUsd: 11550,
      paidThisMonthUsd: 9950,
      overdueCount: 2,
    });

    const parsed = parseServerTiming('app;dur=572;desc="GET /api/invoices", db;dur=551.4, el-p99;dur=1.2', 'GET /api/invoices');
    expect(parsed).toEqual({
      route: 'GET /api/invoices',
      appMs: 572,
      dbMs: 551.4,
      elP99Ms: 1.2,
    });

    await store.loginAsTester('finance-admin');
    expect(store.getSnapshot().user?.role).toBe('finance-admin');
    expect(store.getSnapshot().sessionToken).toContain('sk-live-session');

    store.setLocale('ar');
    expect(store.getSnapshot().locale).toBe('ar');
    expect(store.getSnapshot().dir).toBe('rtl');

    await store.markInvoicePaid('INV-1042');
    expect(store.getSnapshot().totals).toEqual({
      outstandingUsd: 8350,
      paidThisMonthUsd: 13150,
      overdueCount: 1,
    });

    await store.voidOverdueInvoices('Write-off remaining overdue');
    expect(store.getSnapshot().totals).toEqual({
      outstandingUsd: 6400,
      paidThisMonthUsd: 13150,
      overdueCount: 0,
    });
  });

  it('tracks component mount/render timings and exports tester record sessions as Markdown', () => {
    expect(startRecording({ pill: false })).toBe(true);
    reins.markComponent('header', 'mount');
    reins.markComponent('perf-hud', 'mount');
    reins.markComponent('summary-cards', 'mount');
    reins.markComponent('summary-cards', 'render');
    reins.markComponent('invoice-list', 'mount');

    const report = reins.perf();
    expect(typeof report.lifecycle.nowMs).toBe('number');
    const summaryComp = report.components.find((c) => c.id === 'summary-cards');
    expect(summaryComp).toBeDefined();
    expect(summaryComp?.renders).toBeGreaterThanOrEqual(2);

    const session = collectSession('qa-tester-smoke');
    expect(session.source).toBe('record');
    const md = renderMarkdown(session);
    expect(md).toContain('# reins session: qa-tester-smoke');
    expect(md).toContain('record mode (tester export)');
    stopRecording();
  });

  it('instruments /api/invoices with reins/node spans, flags N+1 slow queries, and diffs before/after sessions', async () => {
    const rn = createReinsNode({ NODE_ENV: 'development' });
    await rn.connect({ tokenFile: join(projectRoot, '.reins', 'no-token-for-unit-test'), reconnect: false });
    const api = createInvoiceApi({ reinsNode: rn, initialQueryMode: 'n+1-slow' });
    const srv = createServer(api.handler);
    await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
    const port = (srv.address() as AddressInfo).port;

    try {
      const resSlow = await fetch(`http://127.0.0.1:${port}/api/invoices`, {
        headers: { [TRACE_HEADER]: 'trace-slow-1' },
      });
      expect(resSlow.status).toBe(200);
      expect(resSlow.headers.get('server-timing')).toContain('db;dur=');

      const serverBefore = rn.report();
      expect(serverBefore.requests.length).toBe(1);
      expect(serverBefore.requests[0].traceId).toBe('trace-slow-1');
      expect(serverBefore.requests[0].spans.filter((s) => s.name === 'db.line_items.select').length).toBe(5);

      const beforeSession = buildSession({
        title: 'before-fix',
        source: 'bridge',
        reinsVersion: '0.1.0',
        perf: {
          lifecycle: { ttfbMs: 10, firstPaintMs: 30, firstContentfulPaintMs: 35, domInteractiveMs: 25, domContentLoadedMs: 28, loadMs: 40, domNodes: 50, nowMs: 800 },
          components: [{ id: 'invoice-list', mountedAtMs: 32, lastRenderMs: 50, renders: 2 }],
          api: {
            totalCalls: 1,
            failedCalls: 0,
            avgMs: serverBefore.requests[0].ms,
            maxMs: serverBefore.requests[0].ms,
            slowest: { method: 'GET', url: '/api/invoices', status: 200, startMs: 40, ms: serverBefore.requests[0].ms, traceId: 'trace-slow-1' },
            calls: [{ method: 'GET', url: '/api/invoices', status: 200, startMs: 40, ms: serverBefore.requests[0].ms, traceId: 'trace-slow-1' }],
          },
          actions: [],
          timeline: [],
        },
        server: serverBefore,
      });
      expect(findings(beforeSession).some((f) => f.text.includes('looks like an N+1 query'))).toBe(true);

      // Switch to batched-fast via the registered server action
      await rn.run('set-db-query-mode', { mode: 'batched-fast' });
      await rn.run('reset-server-metrics', {});

      const resFast = await fetch(`http://127.0.0.1:${port}/api/invoices`, {
        headers: { [TRACE_HEADER]: 'trace-fast-2' },
      });
      expect(resFast.status).toBe(200);
      const serverAfter = rn.report();
      expect(serverAfter.requests.length).toBe(1);
      expect(serverAfter.requests[0].ms).toBeLessThan(200);

      const afterSession = buildSession({
        title: 'after-fix',
        source: 'bridge',
        reinsVersion: '0.1.0',
        perf: {
          lifecycle: { ttfbMs: 10, firstPaintMs: 30, firstContentfulPaintMs: 35, domInteractiveMs: 25, domContentLoadedMs: 28, loadMs: 40, domNodes: 50, nowMs: 200 },
          components: [{ id: 'invoice-list', mountedAtMs: 32, lastRenderMs: 50, renders: 2 }],
          api: {
            totalCalls: 1,
            failedCalls: 0,
            avgMs: serverAfter.requests[0].ms,
            maxMs: serverAfter.requests[0].ms,
            slowest: { method: 'GET', url: '/api/invoices', status: 200, startMs: 40, ms: serverAfter.requests[0].ms, traceId: 'trace-fast-2' },
            calls: [{ method: 'GET', url: '/api/invoices', status: 200, startMs: 40, ms: serverAfter.requests[0].ms, traceId: 'trace-fast-2' }],
          },
          actions: [],
          timeline: [],
        },
        server: serverAfter,
      });

      const diff = compareSessions(beforeSession, afterSession);
      expect(diff.resolved.length).toBeGreaterThanOrEqual(2);
      expect(diff.markdown).toContain('### Resolved');
      expect(diff.markdown).toContain('better');
    } finally {
      rn.disconnect();
      srv.closeAllConnections?.();
      await new Promise<void>((r) => srv.close(() => r()));
    }
  }, 15000);

  it('strips all reins and reins/record dev code (__REINS_DEV_ONLY__) from the production Vite build', async () => {
    const outDir = join(projectRoot, 'dist');
    await build({
      root: projectRoot,
      logLevel: 'silent',
    });
    const files = listFiles(outDir);
    const hits = findMarker(outDir);
    expect(files.length).toBeGreaterThan(0);
    expect(hits).toEqual([]);
  }, 20000);
});
