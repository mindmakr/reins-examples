# reins session: before-n1-fix

| Field | Value |
|---|---|
| App | http://localhost:5173/ |
| Title | Payday Invoice Studio — Lucid Billing Desk (reins + Vite + React) |
| Platform | web |
| Recorded | 2026-11-10T22:50:49.291Z |
| Source | bridge (agent) |
| reins | 0.1.0 |

## Summary

| Metric | Value |
|---|---|
| TTFB | 413 ms |
| First contentful paint |  |
| Load | 591 ms |
| DOM nodes | 175 |
| Panels | 5 |
| API calls | 2 (0 failed) |
| API avg / max | 322 ms / 605 ms |
| Errors | 0 |
| Layout issues | 0 |
| Server requests | 2 (slowest route `GET /api/invoices`, avg 593 ms, db 591 ms) |
| Event loop p99 | 65 ms |

## Findings

- ⚠️ Slow API: `GET /api/invoices` took 605 ms (over 500 ms).
- ⚠️ Server: `db.line_items.select` took 544 of 593 ms (92%) in `GET /api/invoices`, called 5 times in one request: looks like an N+1 query, batch it.

## Timeline

Milliseconds since the page started. Server rows sit inside the browser call they answer (joined by trace id).

| At | Kind | What | Duration | Status |
|---|---|---|---|---|
| 413 | lifecycle | ttfb |  |  |
| 432 | lifecycle | domInteractive |  |  |
| 590 | lifecycle | domContentLoaded |  |  |
| 591 | lifecycle | load |  |  |
| 845 | component-mount | header |  |  |
| 846 | component-mount | perf-hud |  |  |
| 846 | component-mount | summary-cards |  |  |
| 846 | component-mount | invoice-list |  |  |
| 846 | component-mount | activity-log |  |  |
| 1311 | action | [reins] login-as-tester | 661 ms |  |
| 1313 | api | POST /api/session/login | 38 ms | 200 |
| 1315 | server | ↳ POST /api/session/login · db.users.find_by_email 16 ms, db.sessions.insert 15 ms | 34 ms (db 31 ms) | 200 |
| 1352 | api | GET /api/invoices?role=finance-admin | 605 ms | 200 |
| 1358 | server | ↳ GET /api/invoices · db.invoices.select 47 ms, db.line_items.select ×5 544 ms | 593 ms (db 591 ms) | 200 |

## API calls

| Method | URL | Status | Duration | Start | Trace |
|---|---|---|---|---|---|
| POST | /api/session/login | 200 | 38 ms | 1313 | ks7d3t-1 |
| GET | /api/invoices?role=finance-admin | 200 | 605 ms | 1352 | ks7d3t-2 |

## Server

Node v22.22.0, up 6 s, RSS 182.4 MB, heap 91.8 MB, event loop p50 15.5 ms / p99 64.9 ms / max 735.6 ms.

| Route | Calls | Avg | Max | Avg db |
|---|---|---|---|---|
| GET /api/invoices | 1 | 593 ms | 593 ms | 591 ms |
| POST /api/session/login | 1 | 34 ms | 34 ms | 31 ms |

### Slowest requests

| Request | Status | Duration | db | Spans | Outbound | Trace |
|---|---|---|---|---|---|---|
| GET /api/invoices?role=finance-admin | 200 | 593 ms | 591 ms | db.invoices.select, db.line_items.select ×5 |  | ks7d3t-2 |
| POST /api/session/login | 200 | 34 ms | 31 ms | db.users.find_by_email, db.sessions.insert |  | ks7d3t-1 |

## Panels

| Panel | Renders | Mounted at | Last render | DOM nodes | Issues |
|---|---|---|---|---|---|
| header | 4 | 845 ms | 1972 ms | 17 | 0 |
| perf-hud | 4 | 846 ms | 1972 ms | 41 | 0 |
| summary-cards | 4 | 846 ms | 1972 ms | 16 | 0 |
| invoice-list | 4 | 846 ms | 1972 ms | 66 | 0 |
| activity-log | 4 | 846 ms | 1972 ms | 23 | 0 |

## Errors

_None._

## Layout issues

_None._

## Actions run

| At | By | Action | Result | Duration |
|---|---|---|---|---|
| 2026-11-10T22:50:49.006Z | agent | login-as-tester | ok | 664 ms |

## Screenshots

_None._
