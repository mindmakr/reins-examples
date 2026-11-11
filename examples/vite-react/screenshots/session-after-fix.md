# reins session: after-batched-fix

| Field | Value |
|---|---|
| App | http://localhost:5173/ |
| Title | Payday Invoice Studio — Lucid Billing Desk (reins + Vite + React) |
| Platform | web |
| Recorded | 2026-11-10T22:50:50.480Z |
| Source | bridge (agent) |
| reins | 0.1.0 |

## Summary

| Metric | Value |
|---|---|
| TTFB | 8 ms |
| First contentful paint | 116 ms |
| Load | 48 ms |
| DOM nodes | 175 |
| Panels | 5 |
| API calls | 2 (0 failed) |
| API avg / max | 37 ms / 41 ms |
| Errors | 0 |
| Layout issues | 0 |
| Server requests | 2 (slowest route `POST /api/session/login`, avg 37 ms, db 37 ms) |
| Event loop p99 | 64 ms |

## Findings

- ✅ Nothing crossed the thresholds.

## Timeline

Milliseconds since the page started. Server rows sit inside the browser call they answer (joined by trace id).

| At | Kind | What | Duration | Status |
|---|---|---|---|---|
| 8 | lifecycle | ttfb |  |  |
| 21 | lifecycle | domInteractive |  |  |
| 47 | lifecycle | domContentLoaded |  |  |
| 48 | lifecycle | load |  |  |
| 76 | component-mount | header |  |  |
| 76 | component-mount | perf-hud |  |  |
| 76 | component-mount | summary-cards |  |  |
| 76 | component-mount | invoice-list |  |  |
| 76 | component-mount | activity-log |  |  |
| 116 | lifecycle | firstContentfulPaint |  |  |
| 849 | api | POST /api/session/login | 41 ms | 200 |
| 849 | action | [reins] login-as-tester | 80 ms |  |
| 851 | server | ↳ POST /api/session/login · db.users.find_by_email 21 ms, db.sessions.insert 16 ms | 37 ms (db 37 ms) | 200 |
| 891 | api | GET /api/invoices?role=finance-admin | 32 ms | 200 |
| 893 | server | ↳ GET /api/invoices · db.invoices.select 11 ms, db.line_items.select_batch 18 ms | 29 ms (db 29 ms) | 200 |

## API calls

| Method | URL | Status | Duration | Start | Trace |
|---|---|---|---|---|---|
| POST | /api/session/login | 200 | 41 ms | 849 | d2y6ei-1 |
| GET | /api/invoices?role=finance-admin | 200 | 32 ms | 891 | d2y6ei-2 |

## Server

Node v22.22.0, up 8 s, RSS 183 MB, heap 94.8 MB, event loop p50 15.5 ms / p99 63.9 ms / max 735.6 ms.

| Route | Calls | Avg | Max | Avg db |
|---|---|---|---|---|
| POST /api/session/login | 1 | 37 ms | 37 ms | 37 ms |
| GET /api/invoices | 1 | 29 ms | 29 ms | 29 ms |

### Slowest requests

| Request | Status | Duration | db | Spans | Outbound | Trace |
|---|---|---|---|---|---|---|
| POST /api/session/login | 200 | 37 ms | 37 ms | db.users.find_by_email, db.sessions.insert |  | d2y6ei-1 |
| GET /api/invoices?role=finance-admin | 200 | 29 ms | 29 ms | db.invoices.select, db.line_items.select_batch |  | d2y6ei-2 |

## Panels

| Panel | Renders | Mounted at | Last render | DOM nodes | Issues |
|---|---|---|---|---|---|
| header | 4 | 76 ms | 928 ms | 17 | 0 |
| perf-hud | 4 | 76 ms | 928 ms | 41 | 0 |
| summary-cards | 4 | 76 ms | 928 ms | 16 | 0 |
| invoice-list | 4 | 76 ms | 928 ms | 66 | 0 |
| activity-log | 4 | 76 ms | 928 ms | 23 | 0 |

## Errors

_None._

## Layout issues

_None._

## Actions run

| At | By | Action | Result | Duration |
|---|---|---|---|---|
| 2026-11-10T22:50:49.006Z | agent | login-as-tester | ok | 664 ms |
| 2026-11-10T22:50:49.303Z | agent | set-db-query-mode | ok | 2 ms |
| 2026-11-10T22:50:49.306Z | agent | reset-server-metrics | ok | 2 ms |
| 2026-11-10T22:50:50.245Z | agent | login-as-tester | ok | 85 ms |

## Screenshots

_None._
