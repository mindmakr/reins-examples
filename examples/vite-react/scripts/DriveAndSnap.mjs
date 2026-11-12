import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer as createNetServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { callTool, fileAudit, Hub } from '@mindmakr/reins/bridge';
import { createServer } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const screenshotsDir = join(projectRoot, 'screenshots');
mkdirSync(screenshotsDir, { recursive: true });

const require = createRequire(import.meta.url);
const reinsCli = resolve(dirname(require.resolve('@mindmakr/reins')), 'cli.js');

const CDP_PORT = 19222;
const CDP_URL = `http://127.0.0.1:${CDP_PORT}`;

async function waitForPairing(hub, { previousBrowserId = 0, expectNode = true, timeoutMs = 12000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const pageClient = hub.current();
    const hasFreshPage = pageClient && pageClient.id !== previousBrowserId;
    const hasNode = !expectNode || hub.nodeClients().length > 0;
    if (hasFreshPage && hasNode) return pageClient;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(
    `Timed out waiting for pairing (browser=${Boolean(hub.current())}, nodeServers=${hub.nodeClients().length})`,
  );
}

function freePort() {
  return new Promise((ok, fail) => {
    const probe = createNetServer();
    probe.once('error', fail);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => ok(port));
    });
  });
}

async function main() {
  console.log('1. Starting reins bridge hub on 127.0.0.1:7357...');
  const audit = fileAudit(projectRoot);
  const hub = await Hub.start({
    dir: projectRoot,
    port: 7357,
    rotate: false,
    audit,
  });

  console.log('2. Starting Vite dev server (with @mindmakr/reins/node backend API)...');
  // A free port, not Vite's default 5173: a browser tab left open on an earlier `npm run dev` keeps asking
  // that port for the pairing token, and would pair with this bridge as a second page in the middle of the run.
  const port = await freePort();
  const vite = await createServer({
    root: projectRoot,
    logLevel: 'silent',
    server: { host: '127.0.0.1', port, strictPort: true },
  });
  await vite.listen();
  const address = vite.httpServer?.address();
  const vitePort = typeof address === 'object' && address ? address.port : 5173;
  const appUrl = `http://localhost:${vitePort}/`;

  console.log(`3. Launching headless Chromium with CDP (${CDP_URL}) -> ${appUrl}`);
  let browser = null;
  for (const channel of [undefined, 'chrome', 'msedge']) {
    try {
      browser = await chromium.launch({
        headless: true,
        ...(channel ? { channel } : {}),
        args: [`--remote-debugging-port=${CDP_PORT}`],
      });
      break;
    } catch {
      // try next channel
    }
  }
  if (!browser) {
    throw new Error('Could not launch Chromium, Chrome, or Edge. Run `npx playwright install chromium`.');
  }

  try {
    const context = await browser.newContext({
      viewport: { width: 1180, height: 980 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await page.goto(appUrl, { waitUntil: 'networkidle' });

    const firstBrowserClient = await waitForPairing(hub, { expectNode: true });
    await page.waitForTimeout(250);

    const ctx = {
      hub,
      dir: projectRoot,
      cdp: CDP_URL,
      audit,
      snaps: [],
    };

    console.log('4. Calling MCP tool: reins_list_actions (frontend + paired @mindmakr/reins/node backend)...');
    const listed = await callTool(ctx, 'reins_list_actions', {});
    if (!Array.isArray(listed?.servers) || listed.servers.length === 0) {
      throw new Error('Expected paired @mindmakr/reins/node server in reins_list_actions.servers');
    }

    // -------------------------------------------------------------------------
    // PHASE A: Baseline ("Before Fix") — Diagnose N+1 slow backend query
    // -------------------------------------------------------------------------
    console.log('5. [Before Fix] Signing in -> triggers GET /api/invoices in n+1-slow mode (~565ms)...');
    await callTool(ctx, 'reins_run_action', {
      name: 'login-as-tester',
      input: { role: 'finance-admin' },
    });
    await page.waitForTimeout(200);

    console.log('6. [Before Fix] Inspecting reins_server & reins_perf (x-reins-trace correlation)...');
    const serverBefore = await callTool(ctx, 'reins_server', { route: '/api/invoices' });
    const perfBefore = await callTool(ctx, 'reins_perf', {});
    const joinedServerSpan = perfBefore?.timeline?.find(
      (e) => e.kind === 'server' && e.name.includes('/api/invoices'),
    );
    if (!joinedServerSpan) {
      throw new Error('Expected x-reins-trace to join server spans into reins_perf.timeline');
    }

    console.log('7. [Before Fix] Capturing baseline session report via reins_report...');
    const reportBefore = await callTool(ctx, 'reins_report', { title: 'before-n1-fix' });
    const hasSlowApiFinding = reportBefore.findings.some((f) => f.key.startsWith('slow-api'));
    const hasN1Finding = reportBefore.findings.some((f) => f.text.includes('looks like an N+1 query'));
    if (!hasSlowApiFinding || !hasN1Finding) {
      throw new Error(
        `Expected reins_report to flag slow API + N+1 server spans, got: ${JSON.stringify(reportBefore.findings)}`,
      );
    }

    const beforeMdPath = join(screenshotsDir, 'session-before-fix.md');
    const beforeJsonPath = join(screenshotsDir, 'session-before-fix.json');
    copyFileSync(reportBefore.files.md, beforeMdPath);
    copyFileSync(reportBefore.files.json, beforeJsonPath);

    // -------------------------------------------------------------------------
    // PHASE B: Apply Batched Query Fix & Run Full Multi-Locale Verification
    // -------------------------------------------------------------------------
    console.log('8. [Fix] Switching backend to batched-fast query mode & resetting metrics...');
    await callTool(ctx, 'reins_run_action', {
      name: 'set-db-query-mode',
      input: { mode: 'batched-fast' },
      target: 'server',
    });
    await callTool(ctx, 'reins_run_action', {
      name: 'reset-server-metrics',
      input: {},
      target: 'server',
    });

    // Reload browser for a clean post-fix session buffer
    ctx.snaps = [];
    await page.reload({ waitUntil: 'networkidle' });
    await waitForPairing(hub, { previousBrowserId: firstBrowserClient.id, expectNode: true });
    await page.waitForTimeout(250);

    console.log('9. [After Fix] Calling reins_run_action -> login-as-tester (batched ~18ms)...');
    const loginResult = await callTool(ctx, 'reins_run_action', {
      name: 'login-as-tester',
      input: { role: 'finance-admin' },
    });
    await page.waitForTimeout(200);

    // Taken at the same point in the flow as the "before" report, so the compare table is like for like:
    // same page load, same sign-in, only the query mode differs.
    const reportAfter = await callTool(ctx, 'reins_report', { title: 'after-batched-fix' });

    console.log('10. Calling MCP tool: reins_snap & reins_dom -> summary-cards (English LTR Light)...');
    const snapSummaryEn = await callTool(ctx, 'reins_snap', { id: 'summary-cards' });
    if (snapSummaryEn?.file) {
      copyFileSync(snapSummaryEn.file, join(screenshotsDir, 'summary-en-light.png'));
    }
    const domSummaryEn = await callTool(ctx, 'reins_dom', {
      panel: 'summary-cards',
      depth: 2,
      maxNodes: 20,
    });
    if (domSummaryEn?.styles?.direction !== 'ltr') {
      throw new Error(`Expected summary-cards direction to be ltr, got: ${domSummaryEn?.styles?.direction}`);
    }
    if (Array.isArray(domSummaryEn?.issues) && domSummaryEn.issues.length > 0) {
      throw new Error(`Unexpected layout issues in summary-cards (EN): ${JSON.stringify(domSummaryEn.issues)}`);
    }
    const domHudEn = await callTool(ctx, 'reins_dom', {
      panel: 'perf-hud',
      depth: 3,
      maxNodes: 40,
    });
    if (Array.isArray(domHudEn?.issues) && domHudEn.issues.length > 0) {
      throw new Error(`Unexpected layout issues in perf-hud (EN): ${JSON.stringify(domHudEn.issues)}`);
    }
    await page.screenshot({ path: join(screenshotsDir, 'full-en-light.png') });

    console.log('11. Calling MCP tool: reins_run_action -> mark-invoice-paid (INV-1042)...');
    const paidResult = await callTool(ctx, 'reins_run_action', {
      name: 'mark-invoice-paid',
      input: { id: 'INV-1042' },
    });

    console.log('12. Verifying consequential action guard on void-overdue-invoices...');
    let refusedError = null;
    try {
      await callTool(ctx, 'reins_run_action', {
        name: 'void-overdue-invoices',
        input: { reason: 'Unconfirmed write-off attempt' },
      });
    } catch (err) {
      refusedError = err.message;
    }
    if (!refusedError || !refusedError.includes('confirm')) {
      throw new Error(`Expected consequential refusal, got: ${refusedError}`);
    }

    const voidResult = await callTool(ctx, 'reins_run_action', {
      name: 'void-overdue-invoices',
      input: { reason: 'Approved Q4 overdue write-off' },
      confirm: true,
    });

    console.log('13. Switching to Arabic (RTL) and Dark theme via reins_run_action...');
    await callTool(ctx, 'reins_run_action', {
      name: 'set-locale',
      input: { locale: 'ar' },
    });
    await callTool(ctx, 'reins_run_action', {
      name: 'set-theme',
      input: { theme: 'dark' },
    });
    await page.waitForTimeout(250);

    console.log('14. Calling MCP tool: reins_snap & reins_dom -> invoice-list (Arabic RTL Dark)...');
    const snapInvoicesAr = await callTool(ctx, 'reins_snap', { id: 'invoice-list' });
    if (snapInvoicesAr?.file) {
      copyFileSync(snapInvoicesAr.file, join(screenshotsDir, 'invoices-ar-rtl-dark.png'));
    }
    const domInvoicesAr = await callTool(ctx, 'reins_dom', {
      panel: 'invoice-list',
      depth: 2,
      maxNodes: 25,
    });
    if (domInvoicesAr?.styles?.direction !== 'rtl') {
      throw new Error(`Expected invoice-list direction to be rtl in Arabic, got: ${domInvoicesAr?.styles?.direction}`);
    }
    if (Array.isArray(domInvoicesAr?.issues) && domInvoicesAr.issues.length > 0) {
      throw new Error(`Unexpected layout issues in invoice-list (AR RTL): ${JSON.stringify(domInvoicesAr.issues)}`);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(100);
    await page.screenshot({ path: join(screenshotsDir, 'full-ar-rtl-dark.png') });

    console.log('15. Inspecting reins_state, reins_network, reins_errors, reins_perf, reins_server & reins_report...');
    const appState = await callTool(ctx, 'reins_state', { name: 'app' });
    const networkCalls = await callTool(ctx, 'reins_network', { limit: 10 });
    const runtimeErrors = await callTool(ctx, 'reins_errors', {});
    const perfAfter = await callTool(ctx, 'reins_perf', {});
    const serverAfter = await callTool(ctx, 'reins_server', {});
    // One more report over the whole drive (both locales, both themes); not saved, only checked for findings.
    const reportFullDrive = await callTool(ctx, 'reins_report', { title: 'full-drive', save: false });

    if (appState?.app?.sessionToken !== '[redacted]') {
      throw new Error(`Expected sessionToken to be [redacted], got: ${appState?.app?.sessionToken}`);
    }
    if (!appState?.app?.lastServerTiming || typeof appState.app.lastServerTiming.dbMs !== 'number') {
      throw new Error(`Expected Server-Timing parsed into app state, got: ${JSON.stringify(appState?.app?.lastServerTiming)}`);
    }
    if (!Array.isArray(runtimeErrors) || runtimeErrors.length !== 0) {
      throw new Error(`Expected 0 runtime errors, got: ${JSON.stringify(runtimeErrors)}`);
    }
    if (!perfAfter?.components || perfAfter.components.length < 5) {
      throw new Error(`Expected >= 5 tracked components in reins_perf, got: ${perfAfter?.components?.length}`);
    }
    for (const [label, report] of [['after the batched fix', reportAfter], ['over the full drive', reportFullDrive]]) {
      if (!Array.isArray(report.findings) || report.findings.length > 0) {
        throw new Error(`Expected 0 findings ${label}, got: ${JSON.stringify(report.findings)}`);
      }
    }

    const afterMdPath = join(screenshotsDir, 'session-after-fix.md');
    const afterJsonPath = join(screenshotsDir, 'session-after-fix.json');
    const compareMdPath = join(screenshotsDir, 'session-compare.md');
    copyFileSync(reportAfter.files.md, afterMdPath);
    copyFileSync(reportAfter.files.json, afterJsonPath);

    // -------------------------------------------------------------------------
    // PHASE C: Run `npx reins report --compare` CLI to diff Before vs After
    // -------------------------------------------------------------------------
    console.log('16. Running CLI: reins report --compare session-before-fix.json session-after-fix.json...');
    const compareMarkdown = execFileSync(
      process.execPath,
      [reinsCli, 'report', '--compare', beforeJsonPath, afterJsonPath, '--out', compareMdPath],
      { cwd: projectRoot, encoding: 'utf8' },
    );
    if (!compareMarkdown.includes('### Resolved') || !compareMarkdown.includes('looks like an N+1 query')) {
      throw new Error('Expected session-compare.md to list resolved N+1 query finding');
    }

    const showcaseReport = {
      reins_list_actions: listed,
      login_result: loginResult,
      mark_paid_result: paidResult,
      consequential_guard: {
        withoutConfirmError: refusedError,
        withConfirmResult: voidResult,
      },
      before_fix: {
        findings: reportBefore.findings,
        server_invoices: serverBefore,
      },
      after_fix: {
        findings: reportAfter.findings,
        full_drive_findings: reportFullDrive.findings,
        server: serverAfter,
      },
      reins_state_app: appState,
      reins_network: networkCalls,
      reins_errors: runtimeErrors,
      reins_perf: perfAfter,
      reins_dom_summary_en_ltr: domSummaryEn,
      reins_dom_invoices_ar_rtl: domInvoicesAr,
      artifacts: [
        'examples/vite-react/screenshots/full-en-light.png',
        'examples/vite-react/screenshots/summary-en-light.png',
        'examples/vite-react/screenshots/full-ar-rtl-dark.png',
        'examples/vite-react/screenshots/invoices-ar-rtl-dark.png',
        'examples/vite-react/screenshots/session-before-fix.md',
        'examples/vite-react/screenshots/session-after-fix.md',
        'examples/vite-react/screenshots/session-compare.md',
      ],
    };

    writeFileSync(
      join(screenshotsDir, 'showcase-output.json'),
      JSON.stringify(showcaseReport, null, 2) + '\n',
    );
    console.log('Showcase complete! Screenshots, session Markdown reports, and session-compare.md written to examples/vite-react/screenshots/');
  } finally {
    await browser.close();
    await vite.close();
    await hub.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
