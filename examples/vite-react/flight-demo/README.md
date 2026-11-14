# Flight demo: Payday Invoice Studio payouts

> **Waits for reins 0.2.0.** `@mindmakr/reins/flight` is new in reins 0.2.0, which is not on npm yet. Until it is, this demo runs on a **local build of reins** (a tarball you make from the reins repository). The rest of this repository still uses the published `@mindmakr/reins` 0.1.x from npm and is not affected.

[reins flight](https://github.com/mindmakr/reins#flight-report-only-checks-on-a-production-server) is the one part of reins meant for production. It records the steps of a server's long-running work, checks them against promises written down in `reins.flight.json`, and reports what it finds to sinks (a webhook, a file) and a report page. **It only reports.** It never retries, settles, rolls back or blocks anything, and it opens no port and adds no route.

This demo gives Payday Invoice Studio a **payout** process: pay an employee from the payroll pool through a bank, then debit the ledger. The bank is simulated and can leave a transfer pending. The demo runs the payout code twice, first broken and then fixed, and shows flight finding both bugs and then confirming they are gone.

## Run it

You need Docker (with Compose) and Node 20 or newer, and a local build of reins with flight:

```sh
# 1. Build the reins tarball (once), from a checkout of mindmakr/reins with flight (0.2.0 or later)
cd reins
npm ci && npm run build
cd packages/reins && npm pack          # makes mindmakr-reins-0.2.0.tgz

# 2. Run the demo, from this folder
cd reins-examples/examples/vite-react/flight-demo
REINS_TARBALL=/path/to/reins/packages/reins/mindmakr-reins-0.2.0.tgz npm run demo
```

Without `REINS_TARBALL`, the demo looks for `../reins/packages/reins/mindmakr-reins-0.2.0.tgz` next to this repository, and stops with the steps above when there is no tarball there. On Windows PowerShell, set the variable first: `$env:REINS_TARBALL = 'D:\path\to\mindmakr-reins-0.2.0.tgz'; npm run demo`.

The one command runs every step, prints `ok` or `FAIL` for each, brings the Docker Compose project down at the end (also after a failure), and exits 1 when any step failed. It takes about a minute and a half after the first image build.

## What it does

| Step | What happens | What it shows |
|---|---|---|
| Build | `scripts/run-demo.mjs` copies the tarball to `vendor/` and builds one Docker image from it. The image makes the example's **browser build** with the local reins and runs `reins verify dist` on it, then sets up the **production server** (`NODE_ENV=production`) with only `@mindmakr/reins/flight` | The browser build ships no development reins; flight is the only reins code on the server |
| Check | `reins flight check reins.flight.json` | The manifest of the payout process and its four promises is valid |
| Broken mode | Docker Compose starts the server, **`reins flight watch`** beside it, and a **local webhook receiver**, on a fresh flight store. The demo pays five payouts. The simulated bank leaves the third pending and confirms the fourth twice. The broken payout code never asks the bank about a pending transfer, and debits the ledger on every confirmation | Flight tells the receiver, in plain words, `1 run of payout has waited more than 15 s after bank.pending for bank.settled or bank.failed (promise: pending-settles)` and `1 run of payout recorded ledger.debited more than once ... (promise: one-debit)`. The report page shows both, and says development instruments are off. `reins verify` passes on the browser build the server serves. The receiver refuses a delivery with a wrong signature |
| Fixed mode | Everything is brought down with its volume and started again in fixed mode, on a fresh store. The same five payouts. The fixed code asks the bank about a pending transfer until it settles, and debits once per payout | Every payout is paid exactly once; all four promises hold; the receiver is told of no broken promise |
| Compare | `reins flight report --compare broken-report.json fixed-report.json` | Both findings **resolved**, **none new**, none still open |

Everything the demo saves goes to `out/` (git-ignored): the receiver's messages (`broken-received.json`, `fixed-received.json`), the report page and its data and Markdown for each mode (`*-report.html`, `*-report.json`, `*-report.md`), `compare.md` and `compare.json`, `check.log`, `verify.log`, `build.log` and each mode's container logs. The report data holds payout ids: treat it as server-side data.

## The pieces

| File | What it is |
|---|---|
| [`reins.flight.json`](reins.flight.json) | The manifest: the `payout` process, its steps (`requested`, `bank.sent`, `bank.pending`, `bank.settled`, `bank.failed`, `ledger.debited`) and four promises, each with its `why`: a pending transfer settles or fails within 15 s (the demo bank settles in seconds; a real one may take hours), the ledger is debited once per payout, only after the bank settled, and every payout ends within 10 minutes |
| [`server/payouts.mjs`](server/payouts.mjs) | The payout process, with `PAYOUT_MODE=broken` or `fixed`. It reports each step with `flight.step('payout', id, step)`. The fix is in this code, not in flight |
| [`server/bank.mjs`](server/bank.mjs) | The simulated bank. `BANK_SCRIPT` (default `settle,settle,pending,duplicate,settle`) says how it treats each transfer. It behaves the same in both modes |
| [`server/main.mjs`](server/main.mjs) | The production server: `flight.start()`, the payout API, `/health` for the watcher, the browser build, and the report page at `/admin/flight` (and `/admin/flight.json`) behind the app's own admin check, rendered with `renderFlightHtml` |
| [`flight.config.mjs`](flight.config.mjs) | Flight's options from the environment: the file store on a volume the server and the watcher share, the signed webhook sink, a file sink, the health address and a 2 s check period for the demo (60 s by default). The server, `reins flight watch` and `reins flight report --config` all load it |
| [`receiver/receiver.mjs`](receiver/receiver.mjs) | A webhook receiver in plain Node with no reins code. It checks each delivery as a [Standard Webhook](https://www.standardwebhooks.com/): the HMAC over the raw body in constant time, a timestamp within 5 minutes, and a `webhook-id` seen only once |
| [`compose.yaml`](compose.yaml), [`Dockerfile`](Dockerfile) | The server, the watcher and the receiver. The watcher and the receiver share the server's network, so flight's webhook can use http to `127.0.0.1` (flight sends to https only, except to localhost). Ports are published on `127.0.0.1` only |
| [`scripts/run-demo.mjs`](scripts/run-demo.mjs) | The one command, in the shape of the example's `npm run demo:agent` |

## Demo-only values

The webhook secret (`FLIGHT_WEBHOOK_SECRET`) and the admin token for the report page (`DEMO_ADMIN_TOKEN`) have defaults marked `demo-only` so the demo runs with no setup. Outside the demo, set your own from the environment or a secret store. A real receiver listens on https.

## When reins 0.2.0 is published

Change `"@mindmakr/reins": "file:vendor/mindmakr-reins.tgz"` in `package.json` to `"^0.2.0"`, install from npm in both Dockerfile stages instead of copying `vendor/mindmakr-reins.tgz`, and drop the tarball step from `scripts/run-demo.mjs`.
