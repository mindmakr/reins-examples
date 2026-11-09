# reins-examples

Official, runnable examples for [**reins**](https://github.com/mindmakr/reins) ([live site & docs](https://mindmakr.github.io/reins/)) — the tiny (< 5 KB min+gzip) dev-only library and agent skill that gives AI coding agents hands and eyes inside your running web and Expo apps. Built for [**Lucid Coding**](https://mindmakr.github.io/coordinator/lucid-coding.html) alongside [**Coordinator**](https://github.com/mindmakr/coordinator) ([site](https://mindmakr.github.io/coordinator/)).

Instead of clicking by pixels and guessing what happened, an agent paired with **reins** calls your app's own named actions, reads redacted state snapshots, inspects recent network calls and runtime errors, and captures pixel-exact `<ReinsPanel>` screenshots across locales (LTR & RTL) and themes. In production builds, `reins` is swapped for an empty stub and `reins verify` guarantees zero dev code ever ships.

---

## Examples Roadmap

| Example | Stack | Highlights | Status |
| --- | --- | --- | --- |
| [`examples/vite-react`](./examples/vite-react) | **Vite + React + TypeScript** | 6 named actions (`useReinsAction`), consequential action confirmation guard, automatic secret redaction in `reins_state` & `reins_network`, 3 locales (`en` LTR, `ar` RTL, `fr` LTR), light/dark themes, 4 `<ReinsPanel>` targets, automated CDP agent showcase (`npm run demo:agent`), and `reins verify dist` bundle gate | **Ready & verified** |
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

Once paired, the agent drives the running app over MCP using the 7 `reins_*` tools:
`reins_list_actions` → `reins_run_action` → `reins_state` → `reins_network` → `reins_errors` → `reins_panel_box` → `reins_snap`.

---

## Featured Example: `examples/vite-react` (Payday Invoice Studio)

### Quickstart

```sh
git clone https://github.com/mindmakr/reins-examples.git
cd reins-examples
npm install

# Run the automated end-to-end agent showcase (Bridge + Vite + headless Chromium CDP + panel snaps)
npm run demo:agent

# Run production build + bundle verification (`vite build && reins verify dist`)
npm run build

# Run Vitest suite
npm test
```

> **Note on installing `reins` in your own project:** This example vendors `vendor/reins-0.1.0.tgz` so CI and fresh clones run `npm install` offline with zero setup. In your own repository, install from npm (`npm i -D reins`) or directly from GitHub (`https://github.com/mindmakr/reins`).

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
  "panels": ["header", "summary-cards", "invoice-list", "activity-log"]
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
  "withoutConfirmError": "reins: \"void-overdue-invoices\" is consequential; call again with confirm: true",
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

#### 6. Zero-Leak Production Bundle Verification (`npm run build`)

Running `npm run build` runs `vite build && reins verify dist`, swapping `reins` for `reins/stub` and scanning every emitted file in `dist/` for `__REINS_DEV_ONLY__`:

```text
> vite build && reins verify dist
vite v6.4.6 building for production...
✓ 34 modules transformed.
dist/index.html                   0.48 kB │ gzip:  0.33 kB
dist/assets/index-BpboXBCF.css    6.28 kB │ gzip:  1.84 kB
dist/assets/index-BQrlBAAp.js   160.38 kB │ gzip: 51.89 kB
✓ built in 457ms
reins-verify-bundle: clean (dist)
```

---

## Companion: Coordinator (Lucid Coding)

Pair [**reins**](https://github.com/mindmakr/reins) with [**Coordinator**](https://github.com/mindmakr/coordinator) ([site](https://mindmakr.github.io/coordinator/)) so isolated builders wire features with `useReinsAction` and `<ReinsPanel>`, and independent **blind visual & code critics** drive the app over MCP, switch locales (`en` ↔ `ar` RTL) and themes, check `reins_state`, `reins_network`, and `reins_errors`, and attach `reins_snap` PNGs as durable proof.

## Licence

[MIT](./LICENSE) © Asif Raja, by [mindmakr](https://github.com/mindmakr)
