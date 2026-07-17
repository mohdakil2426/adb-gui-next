# Active Context

## Current state

ADB GUI Next is a **working Tauri 2 app on `main`**, app version **0.2.5**. Agent docs: thin root `AGENTS.md` router + `src/AGENTS.md`, `src-tauri/AGENTS.md`, `docs/project_rules.md`, `docs/architecture.md`. Reports: `docs/internal/reports/`.

## Focus / recent durable changes (keep short)

| Area | Note |
| --- | --- |
| Agent/docs layout | Router + module guides; skills; Ultracite pointers |
| Quality scripts | Slim package scripts; Husky → lint-staged |
| CI / Rust bar | Quality all branches; package main-only; clippy `-D warnings` |
| Scaffold cleanup | Removed unused `public` SVGs + `src/assets/react.svg` |
| **React Doctor** | Plan pass done: **100/100**, 0 issues (`npx react-doctor@latest .`). Fixes may still be **uncommitted** — commit when user asks |

## Open / deferred — work later

- OPS stream decrypt, ZIP64 `http_zip`, ACL split, Tauri single-instance
- Payload delta “real work” skipped
- Windows `cargo test` loader (`0xc0000139`)
- App Manager icons: Lucide placeholders
- Optional: split large `useFileExplorerViewModel` (size allowlisted for arch test)

## Session lessons (doctor 100 — do not reintroduce)

| Never | Do instead |
| --- | --- |
| `setState` / ref writes / other setters **inside** a functional updater | Pure updater only; side effects in handler/`useEffect` |
| `setTimeout`/`setInterval` in effect without cleanup | Always `return () => clear…` |
| Animate **height** (layout thrash) | `transform` / opacity / `grid-rows-[0fr→1fr]` |
| Import full `motion` under shell | One `LazyMotion` + `m.*` (`MainLayout`) |
| Bare `<button>` | `type="button"` unless submit |
| `role="main"` | Semantic `<main>` |
| Index keys on reorderable lists | Stable ids (e.g. shell history `id` at write site) |
| Dead unused `shared/ui/*` + unused exports | Delete or real import — never fake-import / eslint-disable to silence doctor |
| Parallel multi-APK install on one device | Keep **serial** install/uninstall |
| Device smoke on real Pixel 7a without user OK | Prefer emulator when agent-testing devices |

## Next steps

- User-owned: manual app smoke + commit when ready
- Prefer architecture + module AGENTS over bloating this file
