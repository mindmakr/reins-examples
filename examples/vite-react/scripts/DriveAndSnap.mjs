import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { callTool, fileAudit, Hub } from 'reins/bridge';
import { createServer } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const screenshotsDir = join(projectRoot, 'screenshots');
mkdirSync(screenshotsDir, { recursive: true });

const CDP_PORT = 9222;
const CDP_URL = `http://127.0.0.1:${CDP_PORT}`;

async function waitForPairing(hub, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (hub.current()) return hub.current();
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Timed out waiting for app to pair with reins Hub');
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

  console.log('2. Starting Vite dev server...');
  const vite = await createServer({
    root: projectRoot,
    logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0 },
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

    await waitForPairing(hub);
    // Allow React effects to register all useReinsAction hooks
    await page.waitForTimeout(250);

    const ctx = {
      hub,
      dir: projectRoot,
      cdp: CDP_URL,
      audit,
    };

    console.log('4. Calling MCP tool: reins_list_actions...');
    const listed = await callTool(ctx, 'reins_list_actions', {});

    console.log('5. Calling MCP tool: reins_run_action -> login-as-tester...');
    const loginResult = await callTool(ctx, 'reins_run_action', {
      name: 'login-as-tester',
      input: { role: 'finance-admin' },
    });
    await page.waitForTimeout(200);

    console.log('6. Calling MCP tool: reins_snap -> summary-cards (English LTR Light)...');
    const snapSummaryEn = await callTool(ctx, 'reins_snap', { id: 'summary-cards' });
    if (snapSummaryEn?.file) {
      copyFileSync(snapSummaryEn.file, join(screenshotsDir, 'summary-en-light.png'));
    }
    await page.screenshot({ path: join(screenshotsDir, 'full-en-light.png') });

    console.log('7. Calling MCP tool: reins_run_action -> mark-invoice-paid (INV-1042)...');
    const paidResult = await callTool(ctx, 'reins_run_action', {
      name: 'mark-invoice-paid',
      input: { id: 'INV-1042' },
    });

    console.log('8. Verifying consequential action guard on void-overdue-invoices...');
    let refusedError = null;
    try {
      await callTool(ctx, 'reins_run_action', {
        name: 'void-overdue-invoices',
        input: { reason: 'Unconfirmed write-off attempt' },
      });
    } catch (err) {
      refusedError = err.message;
    }
    if (!refusedError || !refusedError.includes('consequential')) {
      throw new Error(`Expected consequential refusal, got: ${refusedError}`);
    }

    const voidResult = await callTool(ctx, 'reins_run_action', {
      name: 'void-overdue-invoices',
      input: { reason: 'Approved Q4 overdue write-off' },
      confirm: true,
    });

    console.log('9. Switching to Arabic (RTL) and Dark theme via reins_run_action...');
    await callTool(ctx, 'reins_run_action', {
      name: 'set-locale',
      input: { locale: 'ar' },
    });
    await callTool(ctx, 'reins_run_action', {
      name: 'set-theme',
      input: { theme: 'dark' },
    });
    await page.waitForTimeout(250);

    console.log('10. Calling MCP tool: reins_snap -> invoice-list (Arabic RTL Dark)...');
    const snapInvoicesAr = await callTool(ctx, 'reins_snap', { id: 'invoice-list' });
    if (snapInvoicesAr?.file) {
      copyFileSync(snapInvoicesAr.file, join(screenshotsDir, 'invoices-ar-rtl-dark.png'));
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(100);
    await page.screenshot({ path: join(screenshotsDir, 'full-ar-rtl-dark.png') });

    console.log('11. Inspecting reins_state, reins_network, and reins_errors...');
    const appState = await callTool(ctx, 'reins_state', { name: 'app' });
    const networkCalls = await callTool(ctx, 'reins_network', { limit: 10 });
    const runtimeErrors = await callTool(ctx, 'reins_errors', {});

    if (appState?.app?.sessionToken !== '[redacted]') {
      throw new Error(`Expected sessionToken to be [redacted], got: ${appState?.app?.sessionToken}`);
    }
    if (!Array.isArray(runtimeErrors) || runtimeErrors.length !== 0) {
      throw new Error(`Expected 0 runtime errors, got: ${JSON.stringify(runtimeErrors)}`);
    }

    const showcaseReport = {
      reins_list_actions: listed,
      login_result: loginResult,
      mark_paid_result: paidResult,
      consequential_guard: {
        withoutConfirmError: refusedError,
        withConfirmResult: voidResult,
      },
      reins_state_app: appState,
      reins_network: networkCalls,
      reins_errors: runtimeErrors,
      screenshots: [
        'examples/vite-react/screenshots/full-en-light.png',
        'examples/vite-react/screenshots/summary-en-light.png',
        'examples/vite-react/screenshots/full-ar-rtl-dark.png',
        'examples/vite-react/screenshots/invoices-ar-rtl-dark.png',
      ],
    };

    writeFileSync(
      join(screenshotsDir, 'showcase-output.json'),
      JSON.stringify(showcaseReport, null, 2) + '\n',
    );
    console.log('Showcase complete! Screenshots and showcase-output.json written to examples/vite-react/screenshots/');
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
