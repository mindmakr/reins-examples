# reins-examples

Official, runnable examples for [**reins**](https://github.com/mindmakr/reins) ([live site & docs](https://mindmakr.github.io/reins/)) — the tiny (< 5 KB min+gzip) dev-only library and agent skill that gives AI coding agents hands and eyes inside your running web and Expo apps. Built for [**Lucid Coding**](https://mindmakr.github.io/coordinator/lucid-coding.html) alongside [**Coordinator**](https://github.com/mindmakr/coordinator) ([site](https://mindmakr.github.io/coordinator/)).

Instead of clicking by pixels and guessing what happened, an agent paired with **reins** calls your app's own named actions, reads redacted state snapshots, inspects recent network calls and runtime errors, measures page lifecycle, component mount/render timings, and API latency (`reins_perf`), inspects live DOM subtrees, computed CSS, and layout clipping (`reins_dom`), and captures pixel-exact `<ReinsPanel>` screenshots across locales (LTR & RTL) and themes. In production builds, `reins` is swapped for an empty stub and `reins verify` guarantees zero dev code ever ships.

> **Deep Dive for Models & Developers:** Read [**`HOW_IT_WAS_BUILT.md`**](./HOW_IT_WAS_BUILT.md) for the **8 Lucid Coding Principles**, how `reins` stays under **5 KB min+gzip** (`5,106 B`) with zero runtime dependencies, and a step-by-step walkthrough of how coding agents use `reins_perf` and `reins_dom` to diagnose and optimize apps.

---

## New here? Try it in one prompt

Paste this into your coding agent (Claude Code, Codex, Antigravity, Cursor, Gemini CLI):

```text
Clone https://github.com/mindmakr/reins-examples, go into examples/vite-react,
run npm install and npm run demo:agent, then show me the screenshots in
examples/vite-react/screenshots and explain what reins_perf and reins_dom found.
After that, set up reins and Coordinator in my own project the same way
(https://github.com/mindmakr/reins and https://github.com/mindmakr/coordinator).
```

You'll see an agent sign in, pay an invoice, switch the app to Arabic and dark mode, take pictures of each panel, and report how fast the page and each panel appeared and how long each API call took, without clicking a single pixel. The same setup works on your app.

**Vibe coding the first version is fine.** The trouble starts later: an agent changes something, the screen still looks right, but it is now slower, calls an API in a loop, or leaks a token. reins lets your agent see those things; [Coordinator](https://github.com/mindmakr/coordinator) makes a second agent check every change against a bar before it merges. Use both when the app has to keep working.

---

## Examples Roadmap

| Example | Stack | Highlights | Status |
| --- | --- | --- | --- |
| [`examples/vite-react`](./examples/vite-react) | **Vite + React + TypeScript** | 6 named actions (`useReinsAction`), consequential action confirmation guard, automatic secret redaction in `reins_state` & `reins_network`, live performance & diagnostics HUD (`reins_perf` + `reins_dom`), 3 locales (`en` LTR, `ar` RTL, `fr` LTR), light/dark themes, 5 `<ReinsPanel>` targets, automated CDP agent showcase (`npm run demo:agent`), and `reins verify dist` bundle gate | **Ready & verified** |
| `examples/nextjs-app-router` | **Next.js App Router** | `withReins(nextConfig)`, `/api/reins-token` route handler, client `<Reins />` bootstrap, server/client boundary verification (`reins verify .next/static`) | *Next up* |
| `examples/expo-mobile` | **Expo / React Native** | `withReins(metroConfig)`, `connectExpo()`, `<ReinsPanel id>` with `testID`, `adb` & simulator panel snaps | *Planned* |

---

## How an Agent Sets Up and Drives Your App in 3 Steps

You do not need to wire `reins` by hand. Give your coding agent the **reins** skill and let the agent do all the setup, driving, and bundle verification.

### Step 1: Install the `reins` skill

In Claude Code:

```text
/plugin marketplace add mindmakr/reins
/plugin install reins@reins
```

*(In OpenAI Codex CLI, Cursor, or Antigravity: copy `skills/reins/` from [`mindmakr/reins`](https://github.com/mindmakr/reins/tree/main/skills/reins) into `.agents/skills/` or `~/.gemini/config/skills/`.)*

### Step 2: Run `/reins:setup`

When you run `/reins:setup` on a Vite + React project like [`examples/vite-react`](./examples/vite-react), the agent follows the setup playbook automatically:

1. **Wires the build plugin first (`vite.config.ts`)** so `/__reins/token` is served in dev and `reins` resolves to `reins/stub` in production builds:
   ```ts
   import { defineConfig } from 'vite';
   import react from '@vitejs/plugin-react';
   import reins from 'reins/vite';

   export default defineConfig({
     plugins: [reins(), react()],
   });
   ```
2. **Connects in dev mode and registers state sources (`src/main.tsx`)**:
   ```ts
   import { reins } from 'reins';
   import { routerLocation } from 'reins/adapters';
   import { store } from './store';

   if (import.meta.env.DEV) {
     reins.state('app', () => store.getSnapshot());
     reins.state('route', routerLocation());
     void reins.connect({
       meta: { app: 'payday-invoice-studio', framework: 'vite-react' },
     });
   }
   ```
3. **Registers named actions and wraps key regions in `<ReinsPanel id="...">` (`src/App.tsx`)**:
   ```tsx
   import { ReinsPanel, useReinsAction } from 'reins/react';

   useReinsAction({
     name: 'set-locale',
     description: 'Switch the UI locale (en LTR, ar RTL, or fr LTR)',
     input: {
       type: 'object',
       properties: { locale: { type: 'string', enum: ['en', 'ar', 'fr'] } },
       required: ['locale'],
     },
     run: ({ locale }) => store.setLocale(locale),
   });

   useReinsAction({
     name: 'void-overdue-invoices',
     description: 'Write off and void all overdue invoices (consequential; requires confirm: true)',
     consequential: true,
     input: { type: 'object', properties: { reason: { type: 'string' } } },
     run: ({ reason }) => store.voidOverdueInvoices(reason),
   });
   ```
4. **Configures `.mcp.json` and adds `reins verify dist` to `package.json`**:
   ```json
   {
     "mcpServers": {
       "reins": { "command": "npx", "args": ["reins", "bridge"] }
     }
   }
   ```

### Step 3: Run `/reins:drive` (or `npm run demo:agent`)

Once paired, the agent drives the running app over MCP using the 11 `reins_*` tools:
`reins_list_actions` → `reins_run_action` → `reins_state` → `reins_network` → `reins_errors` → `reins_perf` → `reins_dom` → `reins_server` → `reins_panel_box` → `reins_snap` → `reins_report`.

---

## Featured Example: `examples/vite-react` (Payday Invoice Studio)

### Quickstart

```sh
git clone https://github.com/mindmakr/reins-examples.git
cd reins-examples
npm install

# Run the automated end-to-end agent showcase (bridge + Vite with its reins/node API + headless Chromium over CDP):
# panel snaps, a before/after session report and the compare table
npm run demo:agent

# Run production build + bundle verification (`vite build && reins verify dist`)
npm run build

# Run Vitest suite
npm test
```

> **Note on installing `reins` in your own project:** This example vendors `vendor/reins-0.1.0.tgz` so CI and fresh clones run `npm install` offline with zero setup. If you replace that tarball with a newer build of the same version, run `npm run reins:refresh`; a plain `npm install` keeps the copy npm cached under the old hash. In your own repository, install from npm (`npm i -D reins`) or directly from GitHub (`https://github.com/mindmakr/reins`).

---

### Real Visual & MCP Output from `npm run demo:agent`

Running `npm run demo:agent` ([`examples/vite-react/scripts/DriveAndSnap.mjs`](./examples/vite-react/scripts/DriveAndSnap.mjs)) starts the `reins` bridge on `127.0.0.1:7357`, launches the Vite dev server, opens the app in headless Chromium with `--remote-debugging-port=9222`, and executes the full agent loop through `callTool`.

#### 1. Discovering Capabilities (`reins_list_actions`)

The agent calls `reins_list_actions` first to discover every action schema, state source, and `<ReinsPanel>` ID exposed by the paired app:

```json
{
  "app": {
    "url": "http://localhost:5173/",
    "title": "Payday Invoice Studio — Lucid Billing Desk (reins + Vite + React)",
    "meta": { "app": "payday-invoice-studio", "framework": "vite-react" }
  },
  "actions": [
    { "name": "login-as-tester", "consequential": false, "readOnly": false },
    { "name": "set-locale", "consequential": false, "readOnly": false },
    { "name": "set-theme", "consequential": false, "readOnly": false },
    { "name": "filter-invoices", "consequential": false, "readOnly": true },
    { "name": "mark-invoice-paid", "consequential": false, "readOnly": false },
    { "name": "void-overdue-invoices", "consequential": true, "readOnly": false }
  ],
  "states": ["app", "route", "location", "localStorage", "sessionStorage", "cookies"],
  "panels": ["header", "perf-hud", "summary-cards", "invoice-list", "activity-log"]
}
```

#### 2. Signing In & Snapping `<ReinsPanel id="summary-cards">` (English LTR · Light Theme)

The agent calls `reins_run_action` (`login-as-tester`, `{ "role": "finance-admin" }`) and snaps `<ReinsPanel id="summary-cards">` via `reins_snap`:

![Payday Invoice Studio — English LTR Light Mode](./examples/vite-react/screenshots/full-en-light.png)

**Clipped panel snap (`reins_snap` → `id: "summary-cards"`):**

![Summary Cards Panel — English LTR Light](./examples/vite-react/screenshots/summary-en-light.png)

#### 3. Consequential Action Guard (`void-overdue-invoices`)

When the agent calls `mark-invoice-paid` (`{ "id": "INV-1042" }`), `INV-1042` ($3,200) is settled immediately. Next, when the agent calls `void-overdue-invoices` **without** `confirm: true`, `reins` refuses the call and logs the refusal to `.reins/audit.log`:

```json
{
  "withoutConfirmError": "reins: confirm: true required",
  "withConfirmResult": {
    "voidedIds": ["INV-1044"],
    "reason": "Approved Q4 overdue write-off",
    "totals": {
      "outstandingUsd": 6400,
      "paidThisMonthUsd": 13150,
      "overdueCount": 0
    }
  }
}
```

#### 4. Switching to Arabic (RTL) + Dark Theme & Snapping `<ReinsPanel id="invoice-list">`

The agent calls `set-locale` (`{ "locale": "ar" }`) and `set-theme` (`{ "theme": "dark" }`), flipping `document.documentElement.dir` to `"rtl"`, and snaps `<ReinsPanel id="invoice-list">`:

![Payday Invoice Studio — Arabic RTL Dark Mode](./examples/vite-react/screenshots/full-ar-rtl-dark.png)

**Clipped panel snap (`reins_snap` → `id: "invoice-list"`):**

![Invoice List Panel — Arabic RTL Dark](./examples/vite-react/screenshots/invoices-ar-rtl-dark.png)

#### 5. Automatic Secret Redaction in `reins_state` and `reins_network`

Even though the app's internal store holds `sessionToken: "sk-live-session-finance-admin-9941"` and sends `Authorization: Bearer sk-live-session-finance-admin-9941` on every `fetch('/api/...')` call, `reins` automatically redacts sensitive keys and headers before they ever leave the page:

**`reins_state` (`{ "name": "app" }`):**

```json
{
  "app": {
    "user": {
      "name": "Maya Lin",
      "email": "maya.lin@payday.example",
      "role": "finance-admin"
    },
    "sessionToken": "[redacted]",
    "locale": "ar",
    "dir": "rtl",
    "theme": "dark",
    "totals": {
      "outstandingUsd": 6400,
      "paidThisMonthUsd": 13150,
      "overdueCount": 0
    }
  }
}
```

**`reins_network`:**

```json
[
  {
    "method": "GET",
    "url": "/api/invoices?role=finance-admin",
    "status": 200,
    "ms": 1,
    "requestHeaders": {
      "content-type": "application/json",
      "authorization": "[redacted]"
    }
  },
  {
    "method": "POST",
    "url": "/api/invoices/INV-1042/pay",
    "status": 200,
    "ms": 3,
    "requestHeaders": {
      "content-type": "application/json",
      "authorization": "[redacted]"
    },
    "requestBody": "[redacted]"
  }
]
```

#### 6. Performance Telemetry (`reins_perf`) & On-Demand DOM/CSS Layout Inspection (`reins_dom`)

Following **Lucid Coding Principle #2** (*"Give agents instruments, not just screenshots"*) and **Principle #8** (*"Get the work done; performance comes with experience and measurement"*), the agent calls `reins_perf` and `reins_dom` to inspect the unified millisecond timeline and verify LTR/RTL computed CSS without guessing from pixels:

**`reins_perf` (page lifecycle, `<ReinsPanel>` mount/render counts, API latency, and unified timeline):**

```json
{
  "lifecycle": {
    "ttfbMs": 22,
    "domInteractiveMs": 31,
    "domContentLoadedMs": 436,
    "loadMs": 437,
    "firstPaintMs": 460,
    "firstContentfulPaintMs": 596,
    "domNodes": 178,
    "nowMs": 2388
  },
  "components": [
    { "id": "header", "mountedAtMs": 456, "lastRenderMs": 1738, "renders": 14 },
    { "id": "perf-hud", "mountedAtMs": 459, "lastRenderMs": 1738, "renders": 14 },
    { "id": "summary-cards", "mountedAtMs": 460, "lastRenderMs": 1738, "renders": 14 },
    { "id": "invoice-list", "mountedAtMs": 460, "lastRenderMs": 1738, "renders": 14 },
    { "id": "activity-log", "mountedAtMs": 462, "lastRenderMs": 1738, "renders": 14 }
  ],
  "api": {
    "totalCalls": 4,
    "failedCalls": 0,
    "avgMs": 2,
    "maxMs": 2,
    "slowest": { "method": "POST", "url": "/api/session/login", "status": 200, "startMs": 1232, "ms": 2 }
  },
  "actions": [
    { "name": "[reins] login-as-tester", "startMs": 1232, "durationMs": 6 },
    { "name": "[reins] mark-invoice-paid", "startMs": 1723, "durationMs": 4 },
    { "name": "[reins] void-overdue-invoices", "startMs": 1731, "durationMs": 4 },
    { "name": "[reins] set-locale", "startMs": 1735, "durationMs": 2 },
    { "name": "[reins] set-theme", "startMs": 1738, "durationMs": 1 }
  ]
}
```

**`reins_dom` (`{ "panel": "invoice-list", "depth": 2 }` in Arabic RTL Dark Mode):**

```json
{
  "tag": "div",
  "classes": ["panel-card"],
  "panel": "invoice-list",
  "box": { "x": 54, "y": 555, "width": 1072, "height": 342 },
  "styles": {
    "display": "block",
    "direction": "rtl",
    "color": "rgb(248, 250, 252)",
    "backgroundColor": "rgb(17, 24, 39)",
    "overflowX": "visible",
    "overflowY": "visible"
  },
  "issues": []
}
```

See [**`HOW_IT_WAS_BUILT.md`**](./HOW_IT_WAS_BUILT.md) for the complete architecture and code walkthrough.

#### 7. Finding a Slow Backend Query (`reins/node` + `reins_server`)

The example's API ([`server/index.mjs`](./examples/vite-react/server/index.mjs)) runs inside the Vite dev server and is instrumented with `reins/node`. It starts in a deliberately slow mode: one query for the invoices, then one query per invoice for its line items (an N+1). Every browser `fetch('/api/...')` carries an `x-reins-trace` id, so `reins_perf` and `reins_report` can put the server's database spans inside the browser call that caused them:

```text
| At   | Kind   | What                                                                             | Duration            |
| 1425 | api    | GET /api/invoices?role=finance-admin                                             | 597 ms              |
| 1433 | server | ↳ GET /api/invoices · db.invoices.select 39 ms, db.line_items.select ×5 542 ms   | 581 ms (db 581 ms)  |
```

`reins_report` turns that into plain findings, with no thresholds for the agent to remember:

```text
- ⚠️ Slow API: `GET /api/invoices` took 597 ms (over 500 ms).
- ⚠️ Server: `db.line_items.select` took 542 of 581 ms (93%) in `GET /api/invoices`,
  called 5 times in one request: looks like an N+1 query, batch it.
```

The full report is committed as [`session-before-fix.md`](./examples/vite-react/screenshots/session-before-fix.md).

#### 8. Proving the Fix (`reins_report` + `npx reins report --compare`)

The demo then runs the server action `set-db-query-mode` with `{ mode: 'batched-fast' }` (through `reins_run_action` with `target: 'server'`), reloads the page, signs in again and takes a second report at the same point in the flow. `npx reins report --compare before.json after.json` prints the difference:

```text
| Metric             | Before | After | Change                   |
| API max (ms)       | 597    | 31    | ▼ 566 ms (−95%) better   |
| Server db avg (ms) | 307    | 26    | ▼ 281 ms (−92%) better   |
| API calls          | 2      | 2     | = same                   |

### Resolved
- Slow API: `GET /api/invoices` took 597 ms (over 500 ms).
- Server: `db.line_items.select` took 542 of 581 ms (93%) in `GET /api/invoices`, called 5 times in one request: looks like an N+1 query, batch it.

### New
- None.
```

See [`session-after-fix.md`](./examples/vite-react/screenshots/session-after-fix.md) and [`session-compare.md`](./examples/vite-react/screenshots/session-compare.md). Your numbers will differ by a few milliseconds on each run.

#### 9. Tester Record Mode (`reins/record`)

A tester does not need an agent or a bridge. Start the app with `npm run dev` and either open `http://localhost:5173/?reins=record` or click **Record Session** in the HUD. A small `● Recording · Export` pill appears. Click through the bug, then click **Export** to download `reins-session-<time>.md` and `.json`: the same report format as above, with the same redaction. Hand those files to an agent to diagnose. Production builds swap `reins/record` for an empty stub, and `reins verify dist` checks it.

#### 10. Zero-Leak Production Bundle Verification (`npm run build`)

Running `npm run build` runs `vite build && reins verify dist`, swapping `reins` for `reins/stub` and `reins/record` for `reins/record-stub`, and scanning every emitted file in `dist/` for `__REINS_DEV_ONLY__`:

```text
> vite build && reins verify dist
vite v6.4.6 building for production...
✓ 35 modules transformed.
dist/index.html                   0.48 kB │ gzip:  0.33 kB
dist/assets/index-CsHMs6NZ.css    7.96 kB │ gzip:  2.07 kB
dist/assets/index-D4I-yknF.js   165.27 kB │ gzip: 53.36 kB
✓ built in 558ms
reins-verify-bundle: clean (dist)
```

---

## Companion: Coordinator (Lucid Coding)

Pair [**reins**](https://github.com/mindmakr/reins) with [**Coordinator**](https://github.com/mindmakr/coordinator) ([site](https://mindmakr.github.io/coordinator/)) so isolated builders wire features with `useReinsAction` and `<ReinsPanel>`, and independent **blind visual & code critics** drive the app over MCP, switch locales (`en` ↔ `ar` RTL) and themes, check `reins_state`, `reins_network`, and `reins_errors`, and attach `reins_snap` PNGs and `reins_report` before/after files as durable proof.

## Licence

[MIT](./LICENSE) © Asif Raja, by [mindmakr](https://github.com/mindmakr). Copy any example into your own project.

The names "reins" and "Lucid Coding" are covered by the [trademark policy](./TRADEMARKS.md).
