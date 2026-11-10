# reins compare: before-n1-fix → after-batched-fix

Before: 2026-11-10T22:50:49.291Z. After: 2026-11-10T22:50:50.480Z. ▼ means the number went down; for every row here, lower is better.

## Metrics

| Metric | Before | After | Change |
|---|---|---|---|
| TTFB (ms) | 413 | 8 | ▼ 405 ms (−98%) better |
| First contentful paint (ms) |  | 116 |  |
| Load (ms) | 591 | 48 | ▼ 543 ms (−92%) better |
| DOM nodes | 175 | 175 | = same |
| API calls | 2 | 2 | = same |
| Failed API calls | 0 | 0 | = same |
| API avg (ms) | 322 | 37 | ▼ 285 ms (−89%) better |
| API max (ms) | 605 | 41 | ▼ 564 ms (−93%) better |
| Errors | 0 | 0 | = same |
| Layout issues | 0 | 0 | = same |
| Server avg (ms) | 314 | 33 | ▼ 281 ms (−89%) better |
| Server db avg (ms) | 311 | 33 | ▼ 278 ms (−89%) better |
| Event loop p99 (ms) | 64.9 | 63.9 | ▼ 1 ms (−2%) better |

## API time per URL (avg)

| Call | Before (ms) | After (ms) | Change |
|---|---|---|---|
| GET /api/invoices | 605 | 32 | ▼ 573 ms (−95%) better |
| POST /api/session/login | 38 | 41 | ▲ 3 ms (+8%) worse |

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

- Slow API: `GET /api/invoices` took 605 ms (over 500 ms).
- Server: `db.line_items.select` took 544 of 593 ms (92%) in `GET /api/invoices`, called 5 times in one request: looks like an N+1 query, batch it.

### New

- None.

### Still open

- None.
