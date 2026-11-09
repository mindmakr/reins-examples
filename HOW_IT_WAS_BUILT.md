# How It Was Built: Lucid Coding with `reins` and `Coordinator`

This document is written for **both AI coding agents/models to learn from** and **developers/engineers to understand** how [`examples/vite-react`](./examples/vite-react) (*Payday Invoice Studio*) and [`reins`](https://github.com/mindmakr/reins) are architected, how `reins` stays under **5 KB min+gzip** (`5,106 B`) with zero runtime dependencies, and how agents use the **9 `reins_*` MCP instruments**—especially **`reins_perf`** and **`reins_dom`**—to build, diagnose, and verify software at a hard quality bar.

---

## 1. The Lucid Coding Manifesto (8 Principles)

[**Lucid Coding**](https://mindmakr.github.io/coordinator/lucid-coding.html) is a discipline for building software with AI coding agents. It pairs [**Coordinator**](https://github.com/mindmakr/coordinator) (which separates the **Builder** from an independent **Blind Critic** around a frozen acceptance bar) with [**reins**](https://github.com/mindmakr/reins) (which gives those agents live runtime instruments inside the running app).

| # | Lucid Coding Principle | How `Coordinator` + `reins` Implement It Together |
| --- | --- | --- |
| **1** | **Know your system.** | Before writing a line of code, `COORDINATOR.md` and `reins_list_actions` establish the system's exact capabilities: named actions (`useReinsAction`), state sources (`reins.state`), and inspectable UI regions (`<ReinsPanel id>`). |
| **2** | **Give agents instruments, not just screenshots.** | A screenshot is a flat grid of pixels; it cannot tell an agent why an API call took 400ms, whether a component re-rendered 14 times, whether a session token leaked, or why an Arabic label overflowed its container. `reins` exposes **9 runtime MCP instruments**: `reins_list_actions`, `reins_run_action`, `reins_state`, `reins_network`, `reins_errors`, `reins_perf`, `reins_dom`, `reins_panel_box`, and `reins_snap`. |
| **3** | **Agree the bar before the build.** | In Coordinator, the acceptance bar is frozen before the builder starts: e.g., *"All 5 panels mount cleanly, 0 runtime errors, `sessionToken` redacted in `reins_state` and `reins_network`, Arabic RTL flips `direction: 'rtl'` with `issues: []` in `reins_dom`, and `reins verify dist` passes."* |
| **4** | **A blind critic, never the builder, grades the work.** | The builder wires `useReinsAction` and `<ReinsPanel id>`. A separate **blind code/visual critic** connects to the running app via `reins` MCP, drives the actions, inspects `reins_perf` and `reins_dom`, and renders a `PASS` or `FAIL` verdict with exact `GAP` and `CAUSE`. |
| **5** | **Evidence or it didn't happen.** | Every claim is backed by machine-verifiable artifacts: [`showcase-output.json`](./examples/vite-react/screenshots/showcase-output.json) (containing real `reins_perf`, `reins_dom`, `reins_state`, and `reins_network` payloads), pixel-clipped `<ReinsPanel>` PNGs, and `.reins/audit.log`. |
| **6** | **Every run is visible.** | In the browser, `<ReinsPanel id="perf-hud">` renders live lifecycle, mount/render, API latency, and layout diagnostics right on the page, while every agent action logs a `console.groupCollapsed('[reins] <action>')` entry and `performance.measure('[reins] <action>')` span. |
| **7** | **Every run teaches the next.** | When `reins_perf` reveals redundant renders or slow endpoints, or `reins_dom` flags `'horizontal-clip'` in a translated locale, those findings become permanent regression checks in `scripts/DriveAndSnap.mjs` and `test/e2e.test.ts`. |
| **8** | **Get the work done; performance comes with experience and measurement.** | Agents do not guess about performance or prematurely micro-optimize in the dark. First they make the feature work and pass functional/layout bars; then they read **`reins_perf`** (TTFB, FCP, component `mountedAtMs` & `renders`, API `avgMs`/`maxMs`, and the unified millisecond `timeline`) to optimize based on real measurements. |

---

## 2. How `reins` Is Architected Under 5 KB (`5,106 B` min+gzip)

`packages/reins/test/size.test.ts` enforces a hard ceiling of **5,120 B (5 KB) min+gzip** on `packages/reins/src/index.ts`. Even with all 9 MCP capabilities (`perf` and `dom` included), `reins` core compiles to **10,305 B minified / 5,106 B min+gzip** with **zero runtime dependencies**.

Here is how the architecture achieves that:

### 2.1 Lazy Post-Load Pairing & Zero Overhead When Idle
- When `reins.connect()` is called in dev mode, it waits for the page `load` event + `requestIdleCallback` (unless `lazy: false` is passed for immediate E2E scripts).
- **Nothing is patched until the bridge accepts the pairing token**: `window.fetch`, `XMLHttpRequest`, `window.onerror`, `unhandledrejection`, `navigator.modelContext` (WebMCP), and `window.__reins__` are only attached inside `pair(socket)` after `/__reins/token` and the WebSocket handshake succeed. If the bridge disconnects, `unpair()` reverses every patch cleanly.

### 2.2 Unified Millisecond Timeline (`reins_perf`) Without Runtime Bloat
Instead of bundling a heavy tracing SDK, `reins.perf()` combines four lightweight runtime signals that all share `performance.now()` (`startTime` relative to navigation start):
1. **Browser Navigation & Paint Timing (`lifecycle`)**: Reads `performance.getEntriesByType('navigation')[0]` (`responseStart` → `ttfbMs`, `domInteractive`, `domContentLoadedEventEnd`, `loadEventEnd`) and `performance.getEntriesByType('paint')` (`first-paint`, `first-contentful-paint`), plus `document.getElementsByTagName('*').length` (`domNodes`).
2. **Component & Panel Mount/Render Tracking (`components`)**: Inside `ReinsPanel` (`packages/reins/src/react.ts` and `expo.ts`), rendering `<ReinsPanel id="summary-cards">` calls `reins.markComponent(id)`. On first render, `reins` records `mountedAtMs = Math.round(performance.now())`, `lastRenderMs = mountedAtMs`, and `renders = 1`. On subsequent renders, it updates `lastRenderMs` and increments `renders`.
3. **Network Call Start & Duration (`api`)**: `patchNetwork` (`src/network.ts`) records `startMs: Math.round(performance.now())` and `ms: Math.round(performance.now() - t0)` into a fixed-size ring buffer (`ring(100)`). `reins.perf()` computes `totalCalls`, `failedCalls` (`status === 0 || status >= 400`), `avgMs`, `maxMs`, and `slowest`.
4. **Agent Action Spans (`actions`)**: Whenever `runAction` executes a named action, it calls `performance.mark('reins:<name>:<seq>')` before `a.run(input)` and `performance.measure('[reins] <name>', mark)` in `finally`. `reins.perf()` reads `performance.getEntriesByType('measure')` for `[reins] *` entries.
5. **Chronological Merge (`timeline`)**: All four streams are merged and sorted by `atMs`, producing a single millisecond-accurate causal timeline from `ttfb` to the latest agent action.

### 2.3 On-Demand DOM & Computed CSS Inspector (`reins_dom`)
Rather than running a continuous `MutationObserver` or layout thrashing loop, `reins.dom(opts)` inspects the DOM **on demand** when the agent asks:
- Resolves the root element by `panel` (`[data-reins="<panel>"]`), `selector` (`querySelector` inside the panel or `document`), or `document.body`.
- Walks up to `depth` (default `3`) and `maxNodes` (default `40`) elements.
- Reads `el.getBoundingClientRect()` (`box: { x, y, width, height }`) and `getComputedStyle(el)` (`display`, `position`, `flexDirection`, `justifyContent`, `alignItems`, `gap`, `overflowX`, `overflowY`, `direction`, `color`, `backgroundColor`, `fontSize`, `fontWeight`, `opacity`, `visibility`, `zIndex`).
- **Automatic Secret Redaction in DOM Text**: If an element's `id`, `data-reins`, or `name` attribute matches sensitive key patterns (`token`, `secret`, `password`, `auth`, `cookie`, `jwt`, `session`, etc.) or its text looks like a secret (`Bearer ...`, `sk-...`, JWT), `reins_dom` replaces `text` with `"[redacted]"`.
- **Automatic Layout Anomaly Detection (`issues`)**:
  - `'horizontal-clip'`: `el.scrollWidth > el.clientWidth + 1` while `overflowX` is `'hidden'` or `'clip'` or `textOverflow === 'ellipsis'`.
  - `'vertical-clip'`: `el.scrollHeight > el.clientHeight + 1` while `overflowY` is `'hidden'` or `'clip'`.
  - `'zero-size'`: `(r.width === 0 || r.height === 0)` while `display !== 'none'` and `display !== 'contents'`.

### 2.4 Zero-Leak Production Builds (`reins/vite` + `reins/stub` + `reins verify`)
- Every dev bundle that includes `reins` contains the constant `DEV_MARKER = '__REINS_DEV_ONLY__'`.
- During `vite build` (or Next.js / Metro production builds), the `reins()` plugin intercepts module resolution and swaps `reins` for `reins/stub`—a tiny no-op module where `action()`, `state()`, `markComponent()`, `perf()`, and `dom()` do nothing and `DEV_MARKER` is absent.
- Running `reins verify dist` scans every emitted file in `dist/` for `__REINS_DEV_ONLY__` and fails the build if even a single byte of dev instrumentation leaked.

---

## 3. How a Coding Agent Uses `reins_perf` and `reins_dom` to Diagnose and Optimize

Below is the **real JSON output** captured by [`scripts/DriveAndSnap.mjs`](./examples/vite-react/scripts/DriveAndSnap.mjs) in [`examples/vite-react/screenshots/showcase-output.json`](./examples/vite-react/screenshots/showcase-output.json), showing how an agent reads the instruments.

### 3.1 Reading the Unified Millisecond Timeline (`reins_perf`)

When the agent calls `reins_perf` at the end of the showcase run, it receives:

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
    "slowest": {
      "method": "POST",
      "url": "/api/session/login",
      "status": 200,
      "startMs": 1232,
      "ms": 2
    }
  },
  "actions": [
    { "name": "[reins] login-as-tester", "startMs": 1232, "durationMs": 6 },
    { "name": "[reins] mark-invoice-paid", "startMs": 1723, "durationMs": 4 },
    { "name": "[reins] void-overdue-invoices", "startMs": 1731, "durationMs": 4 },
    { "name": "[reins] set-locale", "startMs": 1735, "durationMs": 2 },
    { "name": "[reins] set-theme", "startMs": 1738, "durationMs": 1 }
  ],
  "timeline": [
    { "kind": "lifecycle", "name": "ttfb", "atMs": 22 },
    { "kind": "lifecycle", "name": "domInteractive", "atMs": 31 },
    { "kind": "lifecycle", "name": "domContentLoaded", "atMs": 436 },
    { "kind": "lifecycle", "name": "load", "atMs": 437 },
    { "kind": "component-mount", "name": "header", "atMs": 456 },
    { "kind": "component-mount", "name": "perf-hud", "atMs": 459 },
    { "kind": "component-mount", "name": "summary-cards", "atMs": 460 },
    { "kind": "component-mount", "name": "invoice-list", "atMs": 460 },
    { "kind": "component-mount", "name": "activity-log", "atMs": 462 },
    { "kind": "lifecycle", "name": "firstContentfulPaint", "atMs": 596 },
    { "kind": "api", "name": "POST /api/session/login", "atMs": 1232, "durationMs": 2, "status": 200 },
    { "kind": "action", "name": "[reins] login-as-tester", "atMs": 1232, "durationMs": 6 },
    { "kind": "api", "name": "GET /api/invoices?role=finance-admin", "atMs": 1234, "durationMs": 1, "status": 200 },
    { "kind": "api", "name": "POST /api/invoices/INV-1042/pay", "atMs": 1723, "durationMs": 2, "status": 200 },
    { "kind": "action", "name": "[reins] mark-invoice-paid", "atMs": 1723, "durationMs": 4 },
    { "kind": "api", "name": "POST /api/invoices/void-overdue", "atMs": 1731, "durationMs": 2, "status": 200 },
    { "kind": "action", "name": "[reins] void-overdue-invoices", "atMs": 1731, "durationMs": 4 },
    { "kind": "action", "name": "[reins] set-locale", "atMs": 1735, "durationMs": 2 },
    { "kind": "action", "name": "[reins] set-theme", "atMs": 1738, "durationMs": 1 }
  ]
}
```

**What the agent learns immediately from this single call:**
1. **Boot sequence**: `ttfb` at `22ms` → `load` at `437ms` → all 5 `<ReinsPanel>` regions (`header`, `perf-hud`, `summary-cards`, `invoice-list`, `activity-log`) mounted between `456ms` and `462ms` (a 6ms mount window) → `firstContentfulPaint` at `596ms`.
2. **Action-to-API causality**: At `1232ms`, `[reins] login-as-tester` started, triggering `POST /api/session/login` (`1232ms`, `2ms`) followed by `GET /api/invoices?role=finance-admin` (`1234ms`, `1ms`), completing the entire action in `6ms`.
3. **Render discipline**: If a single action caused `renders` to jump from `4` to `80`, the agent immediately spots an infinite loop or unmemoized store selector in `reins_perf.components` without needing a human to open React DevTools Profiler.

### 3.2 Verifying LTR vs. Arabic RTL Layout & Catching Clipping (`reins_dom`)

Instead of squinting at screenshots to guess whether Arabic (`ar`) actually flipped the DOM to RTL or whether a table header is clipped, the agent calls `reins_dom`:

**English LTR (`reins_dom` on `panel: "summary-cards"`):**
```json
{
  "tag": "div",
  "classes": ["panel-card"],
  "panel": "summary-cards",
  "box": { "x": 54, "y": 347, "width": 1072, "height": 190 },
  "styles": {
    "display": "block",
    "direction": "ltr",
    "color": "rgb(15, 23, 42)",
    "backgroundColor": "rgb(255, 255, 255)",
    "overflowX": "visible",
    "overflowY": "visible"
  },
  "issues": []
}
```

**Arabic RTL + Dark Theme (`reins_dom` on `panel: "invoice-list"`):**
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
  "issues": [],
  "children": [
    {
      "tag": "div",
      "classes": ["toolbar-row"],
      "box": { "x": 77, "y": 574, "width": 1026, "height": 33 },
      "styles": {
        "display": "flex",
        "flexDirection": "row",
        "justifyContent": "space-between",
        "alignItems": "center",
        "direction": "rtl"
      },
      "issues": [],
      "children": [
        {
          "tag": "h2",
          "classes": ["section-heading"],
          "text": "فواتير العملاء",
          "box": { "x": 1020, "y": 579, "width": 83, "height": 23 },
          "styles": { "direction": "rtl", "fontSize": "15.5px", "fontWeight": "700" },
          "issues": []
        }
      ]
    }
  ]
}
```

**What the agent verifies mathematically:**
- `styles.direction` flipped from `"ltr"` to `"rtl"`, and `styles.backgroundColor` changed from `"rgb(255, 255, 255)"` (light) to `"rgb(17, 24, 39)"` (dark).
- The heading `"فواتير العملاء"` (`h2.section-heading`) is anchored at `box.x = 1020` on the right edge of the `1026px`-wide toolbar (`77 + 1026 - 83 = 1020`), proving right-to-left flex alignment before even inspecting the PNG.
- `issues: []` on every node confirms zero `'horizontal-clip'`, `'vertical-clip'`, or `'zero-size'` layout defects.

---

## 4. Step-by-Step Code Walkthrough of `examples/vite-react`

### Step 1: `vite.config.ts` — Wiring `reins/vite` and Dev API Middleware
[`examples/vite-react/vite.config.ts`](./examples/vite-react/vite.config.ts) registers `reins()` first so `/__reins/token` is served in dev mode and `reins` is swapped for `reins/stub` in production builds:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import reins from 'reins/vite';

export default defineConfig({
  plugins: [reins(), invoiceApiMiddleware(), react()],
});
```

### Step 2: `src/main.tsx` — Connecting and Registering State Sources
[`examples/vite-react/src/main.tsx`](./examples/vite-react/src/main.tsx) registers the `app` store snapshot and `route` adapter in `import.meta.env.DEV`:

```tsx
import { reins } from 'reins';
import { routerLocation } from 'reins/adapters';
import { store } from './store';

if (import.meta.env.DEV) {
  reins.state('app', () => store.getSnapshot());
  reins.state('route', routerLocation());
  void reins.connect({
    lazy: false,
    meta: { app: 'payday-invoice-studio', framework: 'vite-react' },
  });
}
```

Because `store.getSnapshot()` includes `sessionToken: "sk-live-session-finance-admin-9941"`, `reins` automatically redacts `sessionToken` to `"[redacted]"` whenever `reins_state` is called.

### Step 3: `src/App.tsx` — Named Actions (`useReinsAction`), `<ReinsPanel>`, and Live Perf HUD
[`examples/vite-react/src/App.tsx`](./examples/vite-react/src/App.tsx) registers 6 actions (`login-as-tester`, `set-locale`, `set-theme`, `filter-invoices`, `mark-invoice-paid`, and `void-overdue-invoices` with `consequential: true`) and wraps the 5 UI regions in `<ReinsPanel id="...">`:
- `<ReinsPanel id="header">`
- `<ReinsPanel id="perf-hud">` (calls `reins.perf()` to display live `TTFB`, `FCP`, `Load`, `domNodes`, panel `mountedAtMs` & `renders`, and API `avgMs`/`maxMs` right in the UI)
- `<ReinsPanel id="summary-cards">`
- `<ReinsPanel id="invoice-list">`
- `<ReinsPanel id="activity-log">`

Every time a `<ReinsPanel id="...">` renders, `ReinsPanel` calls `reins.markComponent(id)` so `reins_perf` automatically tracks its mount timestamp and render count.

### Step 4: `scripts/DriveAndSnap.mjs` — Automated Agent Showcase (`npm run demo:agent`)
[`examples/vite-react/scripts/DriveAndSnap.mjs`](./examples/vite-react/scripts/DriveAndSnap.mjs) runs the complete agent loop headlessly:
1. Starts the `reins` bridge `Hub` on `127.0.0.1:7357` and Vite dev server.
2. Launches headless Chromium with `--remote-debugging-port=19222`.
3. Calls `reins_list_actions` to discover all 6 actions, 6 state sources, and 5 panels.
4. Calls `reins_run_action` (`login-as-tester` as `finance-admin`).
5. Calls `reins_snap` and `reins_dom` on `summary-cards` in English LTR Light mode (`direction === 'ltr'`, `issues.length === 0`).
6. Calls `mark-invoice-paid` (`INV-1042`) and tests the consequential guard on `void-overdue-invoices` (verifying refusal without `confirm: true`, then succeeding with `confirm: true`).
7. Calls `set-locale` (`ar`) and `set-theme` (`dark`), then calls `reins_snap` and `reins_dom` on `invoice-list` (`direction === 'rtl'`, `issues.length === 0`).
8. Calls `reins_state`, `reins_network`, `reins_errors`, and `reins_perf`, asserting secret redaction, 0 runtime errors, component render tracking, and API latency stats, and writes the full evidence report to [`examples/vite-react/screenshots/showcase-output.json`](./examples/vite-react/screenshots/showcase-output.json).
