# reins session: after-batched-fix

| Field | Value |
|---|---|
| App | http://localhost:5173/ |
| Title | Payday Invoice Studio — Lucid Billing Desk (reins + Vite + React) |
| Platform | web |
| Recorded | 2026-11-10T22:16:50.681Z |
| Source | bridge (agent) |
| reins | 0.1.0 |

## Summary

| Metric | Value |
|---|---|
| TTFB | 8 ms |
| First contentful paint | 116 ms |
| Load | 49 ms |
| DOM nodes | 175 |
| Panels | 5 |
| API calls | 2 (0 failed) |
| API avg / max | 30 ms / 31 ms |
| Errors | 0 |
| Layout issues | 0 |
| Server requests | 2 (slowest route `GET /api/invoices`, avg 28 ms, db 27 ms) |
| Event loop p99 | 51 ms |

## Findings

- ✅ Nothing crossed the thresholds.

## Timeline

Milliseconds since the page started. Server rows sit inside the browser call they answer (joined by trace id).

| At | Kind | What | Duration | Status |
|---|---|---|---|---|
| 8 | lifecycle | ttfb |  |  |
| 22 | lifecycle | domInteractive |  |  |
| 48 | lifecycle | domContentLoaded |  |  |
| 49 | lifecycle | load |  |  |
| 77 | component-mount | header |  |  |
| 78 | component-mount | perf-hud |  |  |
| 78 | component-mount | summary-cards |  |  |
| 78 | component-mount | invoice-list |  |  |
| 78 | component-mount | activity-log |  |  |
| 116 | lifecycle | firstContentfulPaint |  |  |
| 858 | action | [reins] login-as-tester | 64 ms |  |
| 859 | api | POST /api/session/login | 28 ms | 200 |
| 861 | server | ↳ POST /api/session/login · db.users.find_by_email 10 ms, db.sessions.insert 15 ms | 25 ms (db 25 ms) | 200 |
| 888 | api | GET /api/invoices?role=finance-admin | 31 ms | 200 |
| 890 | server | ↳ GET /api/invoices · db.invoices.select 12 ms, db.line_items.select_batch 15 ms | 28 ms (db 27 ms) | 200 |

## API calls

| Method | URL | Status | Duration | Start | Trace |
|---|---|---|---|---|---|
| POST | /api/session/login | 200 | 28 ms | 859 | 71e6sd-1 |
| GET | /api/invoices?role=finance-admin | 200 | 31 ms | 888 | 71e6sd-2 |

## Server

Node v22.22.0, up 7 s, RSS 179.9 MB, heap 93.2 MB, event loop p50 15.4 ms / p99 51.3 ms / max 864.6 ms.

| Route | Calls | Avg | Max | Avg db |
|---|---|---|---|---|
| GET /api/invoices | 1 | 28 ms | 28 ms | 27 ms |
| POST /api/session/login | 1 | 25 ms | 25 ms | 25 ms |

### Slowest requests

| Request | Status | Duration | db | Spans | Outbound | Trace |
|---|---|---|---|---|---|---|
| GET /api/invoices?role=finance-admin | 200 | 28 ms | 27 ms | db.invoices.select, db.line_items.select_batch |  | 71e6sd-2 |
| POST /api/session/login | 200 | 25 ms | 25 ms | db.users.find_by_email, db.sessions.insert |  | 71e6sd-1 |

## Panels

| Panel | Renders | Mounted at | Last render | DOM nodes | Issues |
|---|---|---|---|---|---|
| header | 4 | 77 ms | 923 ms | 17 | 0 |
| perf-hud | 4 | 78 ms | 923 ms | 41 | 0 |
| summary-cards | 4 | 78 ms | 923 ms | 16 | 0 |
| invoice-list | 4 | 78 ms | 923 ms | 66 | 0 |
| activity-log | 4 | 78 ms | 923 ms | 23 | 0 |

## Errors

_None._

## Layout issues

_None._

## Actions run

| At | By | Action | Result | Duration |
|---|---|---|---|---|
| 2026-11-10T22:16:49.234Z | agent | login-as-tester | ok | 668 ms |
| 2026-11-10T22:16:49.514Z | agent | set-db-query-mode | ok | 2 ms |
| 2026-11-10T22:16:49.518Z | agent | reset-server-metrics | ok | 3 ms |
| 2026-11-10T22:16:50.451Z | agent | login-as-tester | ok | 67 ms |

## Screenshots

_None._
