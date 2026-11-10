# `examples/vite-react` — Payday Invoice Studio

A complete **Vite + React + TypeScript** example wired with [**reins**](https://github.com/mindmakr/reins) (`reins`, `reins/react`, `reins/adapters`, `reins/vite`, `reins/node`, `reins/record`).

## What it demonstrates

1. **Zero-leak production build (`reins/vite` + `reins verify dist`)**
   - `vite.config.ts` registers `reins()` from `reins/vite`.
   - In `vite dev`, `/__reins/token` serves the one-time pairing token from `.reins/token`.
   - In `vite build`, `reins` is automatically swapped for `reins/stub` (and `reins/record` for `reins/record-stub`), and `reins verify dist` confirms zero `__REINS_DEV_ONLY__` markers exist in `dist/`.
2. **6 named actions (`useReinsAction`)**
   - `login-as-tester` (`{ role: 'finance-admin' | 'viewer' }`) — signs in and fetches `/api/invoices`
   - `set-locale` (`{ locale: 'en' | 'ar' | 'fr' }`) — switches language and flips `document.documentElement.dir` between `ltr` and `rtl`
   - `set-theme` (`{ theme: 'light' | 'dark' }`) — switches between light and dark mode
   - `filter-invoices` (`{ status: 'all' | 'pending' | 'paid' | 'overdue', query?: string }`, `readOnly: true`)
   - `mark-invoice-paid` (`{ id: string }`) — calls `POST /api/invoices/:id/pay`
   - `void-overdue-invoices` (`{ reason?: string }`, `consequential: true`) — refused by `reins` unless called with `confirm: true`
3. **Redacted state & network telemetry (`reins_state` & `reins_network`)**
   - `reins.state('app', () => store.getSnapshot())` exposes `user`, `locale`, `dir`, `theme`, `filter`, `totals`, and `invoices`, while `sessionToken` is automatically replaced with `"[redacted]"`.
   - `fetch('/api/invoices')` and `fetch('/api/invoices/INV-1042/pay')` send `Authorization: Bearer ...`, which `reins_network` automatically redacts to `"[redacted]"`.
4. **5 `<ReinsPanel id="...">` targets (`reins_panel_box`, `reins_snap`, `reins_dom`)**
   - `header`, `perf-hud`, `summary-cards`, `invoice-list`, and `activity-log`.
5. **An instrumented backend (`reins/node`, `reins_server`)**
   - `server/index.mjs` is mounted into the Vite dev server by `vite.config.ts`, pairs with the bridge as a Node server, and wraps each query in `reinsNode.span('db.*', ...)`.
   - It starts in `n+1-slow` mode (five `db.line_items.select` queries per request). The server actions `get-db-query-mode`, `set-db-query-mode` and `reset-server-metrics` are callable with `reins_run_action` and `target: 'server'`.
   - Responses carry a `Server-Timing` header (dev only), which the HUD shows as app, db and event-loop time.
6. **Session reports and a before/after diff (`reins_report`, `npx reins report --compare`)**
   - `npm run demo:agent` writes `screenshots/session-before-fix.md`, `session-after-fix.md` and `session-compare.md` (with the `.json` behind each).
7. **Tester record mode (`reins/record`)**
   - Open `/?reins=record` or click **Record Session** in the HUD, click through the app, then **Export** a Markdown and JSON session. No bridge or agent needed.

## Commands

```sh
# Start the Vite dev server (the instrumented API runs inside it)
npm run dev

# Or run the API on its own port (API_PORT, default 4010)
npm run server

# Run the automated end-to-end agent showcase (bridge + Vite + Chromium CDP: snaps, session reports, compare)
npm run demo:agent

# Build production bundle and verify zero reins code ships
npm run build

# Run Vitest suite
npm test
```
