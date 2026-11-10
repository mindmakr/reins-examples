# reins session: before-n1-fix

| Field | Value |
|---|---|
| App | http://localhost:5173/ |
| Title | Payday Invoice Studio — Lucid Billing Desk (reins + Vite + React) |
| Platform | web |
| Recorded | 2026-11-10T22:16:49.500Z |
| Source | bridge (agent) |
| reins | 0.1.0 |

## Summary

| Metric | Value |
|---|---|
| TTFB | 441 ms |
| First contentful paint |  |
| Load | 630 ms |
| DOM nodes | 175 |
| Panels | 5 |
| API calls | 2 (0 failed) |
| API avg / max | 320 ms / 597 ms |
| Errors | 0 |
| Layout issues | 0 |
| Server requests | 2 (slowest route `GET /api/invoices`, avg 581 ms, db 581 ms) |
| Event loop p99 | 64 ms |

## Findings

- ⚠️ Slow API: `GET /api/invoices` took 597 ms (over 500 ms).
- ⚠️ Server: `db.line_items.select` took 542 of 581 ms (93%) in `GET /api/invoices`, called 5 times in one request: looks like an N+1 query, batch it.

## Timeline

Milliseconds since the page started. Server rows sit inside the browser call they answer (joined by trace id).

| At | Kind | What | Duration | Status |
|---|---|---|---|---|
| 441 | lifecycle | ttfb |  |  |
| 458 | lifecycle | domInteractive |  |  |
| 630 | lifecycle | domContentLoaded |  |  |
| 630 | lifecycle | load |  |  |
| 698 | component-mount | header |  |  |
| 698 | component-mount | perf-hud |  |  |
| 698 | component-mount | summary-cards |  |  |
| 698 | component-mount | invoice-list |  |  |
| 698 | component-mount | activity-log |  |  |
| 1381 | api | POST /api/session/login | 43 ms | 200 |
| 1381 | action | [reins] login-as-tester | 665 ms |  |
| 1383 | server | ↳ POST /api/session/login · db.users.find_by_email 19 ms, db.sessions.insert 15 ms | 39 ms (db 34 ms) | 200 |
| 1425 | api | GET /api/invoices?role=finance-admin | 597 ms | 200 |
| 1433 | server | ↳ GET /api/invoices · db.invoices.select 39 ms, db.line_items.select ×5 542 ms | 581 ms (db 581 ms) | 200 |

## API calls

| Method | URL | Status | Duration | Start | Trace |
|---|---|---|---|---|---|
| POST | /api/session/login | 200 | 43 ms | 1381 | 6wnwk7-1 |
| GET | /api/invoices?role=finance-admin | 200 | 597 ms | 1425 | 6wnwk7-2 |

## Server

Node v22.22.0, up 6 s, RSS 179.4 MB, heap 90.1 MB, event loop p50 15.3 ms / p99 64.4 ms / max 864.6 ms.

| Route | Calls | Avg | Max | Avg db |
|---|---|---|---|---|
| GET /api/invoices | 1 | 581 ms | 581 ms | 581 ms |
| POST /api/session/login | 1 | 39 ms | 39 ms | 34 ms |

### Slowest requests

| Request | Status | Duration | db | Spans | Outbound | Trace |
|---|---|---|---|---|---|---|
| GET /api/invoices?role=finance-admin | 200 | 581 ms | 581 ms | db.invoices.select, db.line_items.select ×5 |  | 6wnwk7-2 |
| POST /api/session/login | 200 | 39 ms | 34 ms | db.users.find_by_email, db.sessions.insert |  | 6wnwk7-1 |

## Panels

| Panel | Renders | Mounted at | Last render | DOM nodes | Issues |
|---|---|---|---|---|---|
| header | 4 | 698 ms | 2046 ms | 17 | 0 |
| perf-hud | 4 | 698 ms | 2046 ms | 41 | 0 |
| summary-cards | 4 | 698 ms | 2046 ms | 16 | 0 |
| invoice-list | 4 | 698 ms | 2046 ms | 66 | 0 |
| activity-log | 4 | 698 ms | 2046 ms | 23 | 0 |

## Errors

_None._

## Layout issues

_None._

## Actions run

| At | By | Action | Result | Duration |
|---|---|---|---|---|
| 2026-11-10T22:16:49.234Z | agent | login-as-tester | ok | 668 ms |

## Screenshots

_None._
