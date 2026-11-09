# `examples/vite-react` — Payday Invoice Studio

A complete **Vite + React + TypeScript** example wired with [**reins**](https://github.com/mindmakr/reins) (`reins`, `reins/react`, `reins/adapters`, `reins/vite`).

## What it demonstrates

1. **Zero-leak production build (`reins/vite` + `reins verify dist`)**
   - `vite.config.ts` registers `reins()` from `reins/vite`.
   - In `vite dev`, `/__reins/token` serves the one-time pairing token from `.reins/token`.
   - In `vite build`, `reins` is automatically swapped for `reins/stub`, and `reins verify dist` confirms zero `__REINS_DEV_ONLY__` markers exist in `dist/`.
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
4. **4 `<ReinsPanel id="...">` targets (`reins_panel_box` & `reins_snap`)**
   - `header`, `summary-cards`, `invoice-list`, and `activity-log`.

## Commands

```sh
# Start the Vite dev server
npm run dev

# Run the automated end-to-end agent showcase (bridge + Vite + Chromium CDP + panel snaps)
npm run demo:agent

# Build production bundle and verify zero reins code ships
npm run build

# Run Vitest suite
npm test
```
