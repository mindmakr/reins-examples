# reins compare: before-n1-fix → after-batched-fix

Before: 2026-11-10T22:16:49.500Z. After: 2026-11-10T22:16:50.681Z. ▼ means the number went down; for every row here, lower is better.

## Metrics

| Metric | Before | After | Change |
|---|---|---|---|
| TTFB (ms) | 441 | 8 | ▼ 433 ms (−98%) better |
| First contentful paint (ms) |  | 116 |  |
| Load (ms) | 630 | 49 | ▼ 581 ms (−92%) better |
| DOM nodes | 175 | 175 | = same |
| API calls | 2 | 2 | = same |
| Failed API calls | 0 | 0 | = same |
| API avg (ms) | 320 | 30 | ▼ 290 ms (−91%) better |
| API max (ms) | 597 | 31 | ▼ 566 ms (−95%) better |
| Errors | 0 | 0 | = same |
| Layout issues | 0 | 0 | = same |
| Server avg (ms) | 310 | 27 | ▼ 283 ms (−91%) better |
| Server db avg (ms) | 307 | 26 | ▼ 281 ms (−92%) better |
| Event loop p99 (ms) | 64.4 | 51.3 | ▼ 13 ms (−20%) better |

## API time per URL (avg)

| Call | Before (ms) | After (ms) | Change |
|---|---|---|---|
| GET /api/invoices | 597 | 31 | ▼ 566 ms (−95%) better |
| POST /api/session/login | 43 | 28 | ▼ 15 ms (−35%) better |

## Panel renders

| Panel | Before | After | Change |
|---|---|---|---|
| activity-log | 4 | 4 | = same |
| header | 4 | 4 | = same |
| invoice-list | 4 | 4 | = same |
| perf-hud | 4 | 4 | = same |
| summary-cards | 4 | 4 | = same |

## Findings

### Resolved

- Slow API: `GET /api/invoices` took 597 ms (over 500 ms).
- Server: `db.line_items.select` took 542 of 581 ms (93%) in `GET /api/invoices`, called 5 times in one request: looks like an N+1 query, batch it.

### New

- None.

### Still open

- None.
