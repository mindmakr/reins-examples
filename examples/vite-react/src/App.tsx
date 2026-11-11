import { useEffect, useState, useSyncExternalStore } from 'react';
import { reins } from 'reins';
import { ReinsPanel, useReinsAction } from 'reins/react';
import { exportSession, isRecording, startRecording } from 'reins/record';
import { TRANSLATIONS, type Locale } from './i18n';
import {
  getVisibleInvoices,
  store,
  type FilterStatus,
  type InvoiceStatus,
  type TesterRole,
  type ThemeMode,
} from './store';

const subscribe = (cb: () => void) => store.subscribe(cb);
const getSnapshot = () => store.getSnapshot();

export function App() {
  const snap = useSyncExternalStore(subscribe, getSnapshot);
  const [, setTick] = useState(0);
  const t = TRANSLATIONS[snap.locale];
  const visibleInvoices = getVisibleInvoices();

  useEffect(() => {
    const timer = setTimeout(() => setTick((n) => n + 1), 60);
    return () => clearTimeout(timer);
  }, []);

  useReinsAction<{ role?: TesterRole }>({
    name: 'login-as-tester',
    description: 'Sign in as a seeded dev tester (finance-admin or viewer) and sync /api/invoices',
    input: {
      type: 'object',
      properties: {
        role: { type: 'string', enum: ['finance-admin', 'viewer'] },
      },
    },
    run: ({ role = 'finance-admin' }) => store.loginAsTester(role),
  });

  useReinsAction<{ locale: Locale }>({
    name: 'set-locale',
    description: 'Switch the UI locale (en LTR, ar RTL, or fr LTR)',
    input: {
      type: 'object',
      properties: {
        locale: { type: 'string', enum: ['en', 'ar', 'fr'] },
      },
      required: ['locale'],
    },
    run: ({ locale }) => store.setLocale(locale),
  });

  useReinsAction<{ theme: ThemeMode }>({
    name: 'set-theme',
    description: 'Switch between light and dark themes',
    input: {
      type: 'object',
      properties: {
        theme: { type: 'string', enum: ['light', 'dark'] },
      },
      required: ['theme'],
    },
    run: ({ theme }) => store.setTheme(theme),
  });

  useReinsAction<{ status: FilterStatus; query?: string }>({
    name: 'filter-invoices',
    description: 'Filter invoices by status (all, pending, paid, overdue) and optional search query',
    input: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['all', 'pending', 'paid', 'overdue'] },
        query: { type: 'string' },
      },
      required: ['status'],
    },
    readOnly: true,
    run: ({ status, query }) => store.filterInvoices(status, query),
  });

  useReinsAction<{ id: string }>({
    name: 'mark-invoice-paid',
    description: 'Mark a single invoice as paid via POST /api/invoices/:id/pay',
    input: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Invoice ID such as INV-1042' },
      },
      required: ['id'],
    },
    run: ({ id }) => store.markInvoicePaid(id),
  });

  useReinsAction<{ reason?: string }>({
    name: 'void-overdue-invoices',
    description: 'Write off and void all overdue invoices (consequential; requires confirm: true)',
    consequential: true,
    input: {
      type: 'object',
      properties: {
        reason: { type: 'string' },
      },
    },
    run: ({ reason }) => store.voidOverdueInvoices(reason),
  });

  const formatUsd = (amount: number) => `$${amount.toLocaleString('en-US')}`;

  const statusLabel = (status: InvoiceStatus) => {
    switch (status) {
      case 'paid':
        return t.statusPaid;
      case 'pending':
        return t.statusPending;
      case 'overdue':
        return t.statusOverdue;
      case 'voided':
        return t.statusVoided;
    }
  };

  const userDisplay = !snap.user
    ? t.roleGuest
    : snap.user.role === 'finance-admin'
      ? t.roleFinanceAdmin
      : t.roleViewer;

  const perf = reins.perf();

  return (
    <div className="app-shell">
      <ReinsPanel id="header" className="panel-card header-bar">
        <div className="brand-group">
          <div className="brand-logo">P</div>
          <div>
            <h1 className="brand-title">
              <span>{t.brandTitle}</span>
              <span className="paired-pill">{t.pairedBadge}</span>
            </h1>
            <p className="brand-subtitle">{t.brandSubtitle}</p>
          </div>
        </div>

        <div className="header-controls">
          <span className="user-badge">{userDisplay}</span>
          {!snap.user && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => void store.loginAsTester('finance-admin')}
            >
              {t.loginAsAdmin}
            </button>
          )}

          <div className="segmented" role="group" aria-label="Locale Switcher">
            {(['en', 'ar', 'fr'] as const).map((loc) => (
              <button
                key={loc}
                type="button"
                className={`seg-btn ${snap.locale === loc ? 'active' : ''}`}
                onClick={() => store.setLocale(loc)}
              >
                {loc === 'ar' ? 'العربية' : loc.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="segmented" role="group" aria-label="Theme Switcher">
            {(['light', 'dark'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`seg-btn ${snap.theme === mode ? 'active' : ''}`}
                onClick={() => store.setTheme(mode)}
              >
                {mode === 'light' ? t.themeLight : t.themeDark}
              </button>
            ))}
          </div>
        </div>
      </ReinsPanel>

      <ReinsPanel id="perf-hud" className="panel-card hud-bar">
        <div className="hud-header">
          <div>
            <h2 className="hud-title">{t.hudTitle}</h2>
            <span className="hud-subtitle">{t.hudSubtitle}</span>
          </div>
          {import.meta.env.DEV && (
            <div className="hud-actions">
              <button
                type="button"
                className="btn-hud"
                onClick={() => {
                  if (!isRecording()) {
                    startRecording({ pill: true });
                    setTick((n) => n + 1);
                  } else {
                    exportSession({ title: 'payday-tester-session' });
                  }
                }}
              >
                {isRecording() ? t.hudExportBtn : t.hudRecordBtn}
              </button>
            </div>
          )}
        </div>
        <div className="hud-grid">
          <div className="hud-box">
            <div className="hud-box-label">{t.hudLifecycle}</div>
            <div className="hud-pills">
              <span className="hud-pill">TTFB {perf.lifecycle.ttfbMs ?? 0}ms</span>
              <span className="hud-pill">FCP {perf.lifecycle.firstContentfulPaintMs ?? 0}ms</span>
              <span className="hud-pill">Load {perf.lifecycle.loadMs ?? 0}ms</span>
              <span className="hud-pill">{perf.lifecycle.domNodes} DOM nodes</span>
            </div>
          </div>

          <div className="hud-box">
            <div className="hud-box-label">{t.hudComponents}</div>
            <div className="hud-pills">
              {perf.components.slice(0, 4).map((c) => (
                <span key={c.id} className="hud-pill">
                  {c.id} @{c.mountedAtMs}ms · ×{c.renders}
                </span>
              ))}
            </div>
          </div>

          <div className="hud-box">
            <div className="hud-box-label">{t.hudApiLatency}</div>
            <div className="hud-pills">
              <span className="hud-pill">{perf.api.totalCalls} calls</span>
              <span className="hud-pill">avg {perf.api.avgMs}ms</span>
              <span className={`hud-pill ${perf.api.maxMs > 500 ? 'warn' : 'ok'}`}>max {perf.api.maxMs}ms</span>
              <span className="hud-pill ok">{perf.api.failedCalls} failed</span>
            </div>
          </div>

          <div className="hud-box">
            <div className="hud-box-label">{t.hudServerTiming}</div>
            <div className="hud-pills">
              {snap.lastServerTiming ? (
                <>
                  <span className="hud-pill">app {snap.lastServerTiming.appMs}ms</span>
                  <span className={`hud-pill ${snap.lastServerTiming.dbMs > 200 ? 'warn' : 'ok'}`}>
                    db {snap.lastServerTiming.dbMs}ms
                  </span>
                  <span className="hud-pill">el-p99 {snap.lastServerTiming.elP99Ms}ms</span>
                </>
              ) : (
                <span className="hud-pill">idle (sign in to query)</span>
              )}
            </div>
          </div>

          <div className="hud-box">
            <div className="hud-box-label">{t.hudLayoutHealth}</div>
            <div className="hud-pills">
              <span className="hud-pill">dir: {snap.dir.toUpperCase()}</span>
              <span className="hud-pill">theme: {snap.theme}</span>
              <span className="hud-pill ok">{t.hudZeroClip}</span>
            </div>
          </div>
        </div>
      </ReinsPanel>

      <ReinsPanel id="summary-cards" className="panel-card">
        <div className="toolbar-row" style={{ marginBottom: 12 }}>
          <h2 className="section-heading">{t.summaryTitle}</h2>
        </div>
        <div className="summary-grid">
          <div className="metric-card">
            <div className="metric-label">{t.totalOutstanding}</div>
            <div className="metric-value">{formatUsd(snap.totals.outstandingUsd)}</div>
            <div className="metric-sub">{t.totalOutstandingSub}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">{t.paidThisMonth}</div>
            <div className="metric-value paid-highlight">{formatUsd(snap.totals.paidThisMonthUsd)}</div>
            <div className="metric-sub">{t.paidThisMonthSub}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">{t.overdueCount}</div>
            <div className="metric-value overdue-highlight">{snap.totals.overdueCount}</div>
            <div className="metric-sub">{t.overdueCountSub}</div>
          </div>
        </div>
      </ReinsPanel>

      <ReinsPanel id="invoice-list" className="panel-card">
        <div className="toolbar-row">
          <h2 className="section-heading">{t.invoicesTitle}</h2>
          <div className="filter-controls">
            <div className="segmented" role="group" aria-label="Invoice Filter">
              {(
                [
                  ['all', t.filterAll],
                  ['pending', t.filterPending],
                  ['paid', t.filterPaid],
                  ['overdue', t.filterOverdue],
                ] as const
              ).map(([statusKey, label]) => (
                <button
                  key={statusKey}
                  type="button"
                  className={`seg-btn ${snap.filter === statusKey ? 'active' : ''}`}
                  onClick={() => store.filterInvoices(statusKey)}
                >
                  {label}
                </button>
              ))}
            </div>

            <input
              type="search"
              className="search-input"
              placeholder={t.searchPlaceholder}
              value={snap.query}
              onChange={(e) => store.setSearchQuery(e.target.value)}
            />

            <button
              type="button"
              className="btn-danger"
              onClick={() => void store.voidOverdueInvoices('Manual write-off')}
            >
              {t.voidOverdueBtn}
            </button>
          </div>
        </div>

        <table className="invoice-table">
          <thead>
            <tr>
              <th>{t.colInvoice}</th>
              <th>{t.colClient}</th>
              <th>{t.colDueDate}</th>
              <th>{t.colAmount}</th>
              <th>{t.colStatus}</th>
              <th>{t.colAction}</th>
            </tr>
          </thead>
          <tbody>
            {visibleInvoices.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                  {t.noInvoicesMatch}
                </td>
              </tr>
            ) : (
              visibleInvoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="invoice-id">{inv.id}</td>
                  <td>{snap.locale === 'ar' ? inv.clientAr : inv.client}</td>
                  <td>{inv.dueDate}</td>
                  <td className="amount-cell">{formatUsd(inv.amount)}</td>
                  <td>
                    <span className={`status-chip status-${inv.status}`}>{statusLabel(inv.status)}</span>
                  </td>
                  <td>
                    {inv.status === 'pending' || inv.status === 'overdue' ? (
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => void store.markInvoicePaid(inv.id)}
                      >
                        {t.markPaidBtn}
                      </button>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.settledLabel}</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </ReinsPanel>

      <ReinsPanel id="activity-log" className="panel-card">
        <div className="toolbar-row" style={{ marginBottom: 4 }}>
          <h2 className="section-heading">{t.activityTitle}</h2>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.activitySubtitle}</span>
        </div>
        <div className="activity-list">
          {snap.activityLog.slice(0, 5).map((entry) => (
            <div key={entry.id} className="activity-item">
              <div className="activity-left">
                <span className="method-badge">{entry.method}</span>
                <span className="endpoint-code">{entry.endpoint}</span>
                <span className="activity-note">— {entry.note}</span>
              </div>
              <span className="activity-time">
                HTTP {entry.status} · {entry.at}
              </span>
            </div>
          ))}
        </div>
      </ReinsPanel>
    </div>
  );
}
