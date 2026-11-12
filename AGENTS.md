# Working with `reins` in `reins-examples`

This repository showcases how coding agents set up, drive, inspect, and verify apps using [**reins**](https://github.com/mindmakr/reins).

## Installing the `reins` Agent Skill

In Claude Code:

```text
/plugin marketplace add mindmakr/reins
/plugin install reins@reins
```

Then use the three skill commands:

- `/reins:setup` — inspects a repo and wires `reins` end-to-end (build plugin first, dev-only `reins.connect()`, state adapters, `useReinsAction`, `<ReinsPanel>`, `.mcp.json`, and `reins verify` in the build script).
- `/reins:drive` — drives the paired app and its dev server through the 11 MCP tools (`reins_list_actions`, `reins_run_action`, `reins_state`, `reins_network`, `reins_errors`, `reins_panel_box`, `reins_snap`, `reins_perf`, `reins_dom`, `reins_server`, `reins_report`).
- `/reins:verify` — runs the production build and confirms zero `reins` code (`__REINS_DEV_ONLY__`) remains in the bundle.

## Driving `examples/vite-react`

1. Start the app (`npm run dev` in `examples/vite-react`) and pair via the `reins` MCP server (`npx reins bridge`).
2. Or run the full automated agent showcase (`npm run demo:agent`), which starts the bridge, Vite dev server, and headless Chromium with CDP enabled, calls every `reins_*` MCP tool, finds the deliberate N+1 query in the `@mindmakr/reins/node` API, switches it to the batched query and writes `session-before-fix.md`, `session-after-fix.md` and `session-compare.md`, verifies automatic secret redaction and consequential action confirmation, and captures panel screenshots across English (LTR, light) and Arabic (RTL, dark).
3. Always run `npm run build` (`vite build && reins verify dist`) and `npm test` before finishing changes.
