import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findMarker, listFiles } from 'reins/verify';
import { build } from 'vite';
import { beforeEach, describe, expect, it } from 'vitest';
import { store } from '../src/store';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

describe('Payday Invoice Studio (examples/vite-react)', () => {
  beforeEach(() => {
    store.resetForTests();
  });

  it('computes initial totals and updates state across actions', async () => {
    const initial = store.getSnapshot();
    expect(initial.locale).toBe('en');
    expect(initial.dir).toBe('ltr');
    expect(initial.totals).toEqual({
      outstandingUsd: 11550,
      paidThisMonthUsd: 9950,
      overdueCount: 2,
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

  it('strips all reins dev code (__REINS_DEV_ONLY__) from the production Vite build', async () => {
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
