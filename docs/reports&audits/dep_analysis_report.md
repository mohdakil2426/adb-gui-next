# ADB GUI Next — Dependency Analysis Report

> **Generated**: 2026-03-22 | **Project version**: 0.1.0 | **Branch**: main
>
> Sources: Memory bank (all 6 files), full codebase scan, [docs/dependencies/dep.md](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/docs/dependencies/dep.md), web research, Tauri / React / Rust docs.

---

## Codebase Snapshot (Verified)

| Area | Current State |
|------|--------------|
| Frontend | React 19.2 + TypeScript 5.9 + Vite 8 + Tailwind v4 + Zustand 5 |
| UI Primitives | shadcn/ui (new-york), Radix UI, lucide-react |
| State | Zustand (device, log, payloadDumper) + localStorage (nicknames only) |
| Backend | Rust 2024 edition, Tauri 2, 26 commands, 4-module payload parser |
| Logging | `tauri-plugin-log` + [log](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewDashboard.tsx#171-175) crate (info/debug/warn/error macros) |
| Forms | Plain `useState` per field — **no form library** |
| Validation | None — raw checks in Rust commands (`.trim()`, `.is_empty()`) |
| Testing (FE) | **None** — zero JS/TS test framework |
| Testing (Rust) | 8 unit tests passing |
| Known Issues | 589 KB JS chunk, device polling duplicated across 3 views |

---

## dep.md Validation — Entry-by-Entry

### ✅ 1. `@tanstack/react-query` v5

**dep.md claim**: "Confirmed React 19 compatible. Ideal for wrapping `invoke()` calls with loading/error/cache states."

**Verdict: ✅ CONFIRMED — but evaluate fit carefully before adding.**

**Research findings (2025-2026):**
- TanStack Query v5 (currently `5.94.5`) requires React ≥ 18. Fully compatible with React 19 via `useSyncExternalStore`. Actively maintained by the Tanstack org, 2M+ weekly downloads.
- The promise-based nature of `core.invoke()` is a perfect match — `useQuery(() => GetDevices())` replaces the `setInterval` + `useState` pattern used in all 3 polling views.
- A Jan 2025 article demonstrates React Query + Tauri 2 + SQLite integration as a reference pattern.
- **Codebase gap**: All 8 views use either raw `useState` + `useEffect` + `setInterval` or inline async handlers. [GetDevices()](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/lib/desktop/backend.ts#79-82) is called every 3 seconds in Dashboard, Flasher, and Utilities via manual polling loops.

**Real benefit if added:**
- `useQuery` with `refetchInterval: 3000` replaces 3 duplicated polling `useEffect` blocks → **directly fixes the "device polling duplicated" known issue**.
- `useMutation` replaces every `try/catch` wrapper around [install_package](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src-tauri/src/commands/apps.rs#31-45), `flash_partition`, etc. — automatic `isPending`, `isError`, `data` states.
- **No cache concerns**: All Tauri backend calls are local/device-specific with no HTTP caching semantics — use `staleTime: 0` for polling queries.

**Action: MEDIUM priority. Worth adding when refactoring the polling pattern.**

---

### ✅ 2. `zod`

**dep.md claim**: "Stable, no issues with React 19. Best for IP address, port, custom ADB commands."

**Verdict: ✅ CONFIRMED — but note: Zod v4 released May 2025.**

**Research findings (2025-2026):**
- **Zod v4** (released May 2025, stable Aug 2025) is a major improvement: 14× faster string parsing, 2.3× smaller bundle, type-safe metadata system, built-in JSON Schema output. Breaking changes from v3 are minimal for basic usage.
- [dep.md](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/docs/dependencies/dep.md) wrote this for v3 (`^3.x`). You should install **v4** directly if adding today.
- React 19 + Zod pairing is the 2025 gold standard for TypeScript-first validation.

**Codebase gap:** The wireless ADB form in [ViewDashboard.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewDashboard.tsx) uses raw string state for IP + port with zero validation before calling [ConnectWirelessAdb()](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/lib/desktop/backend.ts#39-42). [ViewFlasher.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewFlasher.tsx) similarly calls [FlashPartition()](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/lib/desktop/backend.ts#63-66) without validating the partition name. [ViewShell.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewShell.tsx) sends raw command strings to [RunShellCommand()](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/lib/desktop/backend.ts#145-148).

**Real benefit if added:**
```ts
const wirelessSchema = z.object({
  ip: z.string().ip({ version: 'v4', message: 'Invalid IPv4 address' }),
  port: z.string().regex(/^\d{4,5}$/, 'Port must be 4-5 digits'),
});
```
Prevents bad data from ever reaching the Rust backend. Avoids defensive `.trim()` / `.is_empty()` checks scattered across Rust commands.

**Action: HIGH priority. Small dep, massive input safety improvement.**

---

### ✅ 3. `react-hook-form`

**dep.md claim**: "Confirmed works with React 19. Best paired with zod for form validation."

**Verdict: ✅ CONFIRMED — with one React 19 caveat.**

**Research findings (2025-2026):**
- RHF 7.x is fully compatible with React 19. Minor caveat: `watch()` may not reliably trigger re-renders in React 19 due to more aggressive batching — use `useWatch()` instead for reactive field observing.
- `@hookform/resolvers/zod` bridges Zod v4 and RHF seamlessly.
- RHF fills the gap React 19's native form APIs leave (no built-in complex validation).

**Codebase assessment:** Wireless ADB form (2 inputs, 3 buttons) and Shell command input are the primary candidates. The wireless form in [ViewDashboard.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewDashboard.tsx) has 50+ lines of `useState` + handler boilerplate that compresses to ~15 lines with RHF + Zod.

**Real benefit if added (paired with zod):**
```tsx
const form = useForm<z.infer<typeof wirelessSchema>>({
  resolver: zodResolver(wirelessSchema),
  defaultValues: { ip: '', port: '5555' }
});
```
Eliminates `wirelessIp`, `wirelessPort`, `setWirelessIp`, `setWirelessPort` state + manual empty checks.

**Action: MEDIUM priority. Add together with zod as a package.**

---

### ⚠️ 4. `@tauri-apps/plugin-shell`

**dep.md claim**: "Required for spawning ADB subprocesses from the frontend side."

**Verdict: ⚠️ PARTIALLY INCORRECT FOR THIS PROJECT — ADB is already done in Rust.**

**Research findings (2025-2026):**
- Plugin-shell v2 is stable and actively maintained. CVE-2025-31477 (open endpoint scope leak) was patched in `2.2.1`. Keep updated.
- **Key issue found**: The plugin's `spawn()` has a documented intermittent hang on Windows (v2.0.2). Path resolution for Android SDK tools (including calling bundled executables) has reported "no such file or directory" errors on some systems.
- Subprocess security requires explicit allowlisting in `tauri.conf.json` — each command + argument must be scoped.

**Codebase assessment:** This project does NOT need `plugin-shell`. All 26 Tauri commands spawn ADB/fastboot via `std::process::Command` in Rust (see `helpers.rs:151–210`). The [resolve_binary_path()](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src-tauri/src/helpers.rs#88-125) three-tier fallback handles binary discovery. No frontend-side subprocess spawning is used or needed.

Adding `plugin-shell` would introduce a parallel, less controlled path for binary execution that bypasses the established Rust [helpers.rs](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src-tauri/src/helpers.rs) pattern — creating duplicated logic and a wider attack surface.

**Action: DO NOT ADD. Current Rust-based approach is architecturally superior.**

---

### ✅ 5. `@tauri-apps/plugin-notification`

**dep.md claim**: "Stable at v2.2.2+. Useful for notifying when long ADB operations complete."

**Verdict: ✅ CONFIRMED — Latest is v2.3.3 (early 2026).**

**Research findings (2025-2026):**
- `tauri-plugin-notification` is actively maintained by the Tauri team, latest `2.3.3`.
- Uses the OS notification system (Windows Action Center, Linux libnotify). Works headlessly when the Tauri window is hidden or minimized.
- Requires `notification:default` capability grant.

**Codebase assessment:** The payload dumper ([ViewPayloadDumper.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewPayloadDumper.tsx) — 30KB, most complex view) runs a long extraction that can take minutes. Currently it only provides in-app sonner toasts. An OS notification when extraction finishes would be genuinely useful. Flash operations in [ViewFlasher.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewFlasher.tsx) are similarly long-running.

**Real benefit if added**: `sendNotification({ title: 'Extraction Complete', body: '5 partitions extracted to /output' })` when `extract_payload` resolves — user can minimize the window and get notified.

**Action: LOW-MEDIUM priority. Good quality-of-life improvement for long operations.**

---

### ✅ 6. `@tauri-apps/plugin-clipboard-manager`

**dep.md claim**: "Stable at v2.3.2. One-click copy for device info and ADB commands."

**Verdict: ✅ CONFIRMED — Latest confirmed at v2.3.2.**

**Research findings (2025-2026):**
- Plugin is actively maintained by Tauri team, stable.
- Requires `clipboard-manager:allow-write-text` capability.
- `writeText(text)` is the primary API — simple Promise-based call.

**Codebase assessment:** [ViewDashboard.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewDashboard.tsx) shows device info (serial, IP, build number, Android version) in a grid of [InfoItem](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewDashboard.tsx#356-381) cards. Currently no copy button exists. In [ViewShell.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewShell.tsx) (7KB), command output would benefit from a one-click copy. Bootloader variables in [ViewFlasher.tsx](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewFlasher.tsx) are a third good candidate.

**Real benefit if added:** Minimal implementation — a `CopyButton` component wrapping `writeText()` that appears on hover over info rows. Very low effort, high UX value.

**Action: MEDIUM priority. Highly visible UX improvement, minimal implementation cost.**

---

### ✅ 7. `@tauri-apps/plugin-process`

**dep.md claim**: "Stable at v2.3.1. Provides exit() and relaunch() for app restart on settings change."

**Verdict: ✅ CONFIRMED — Latest is v2.2.2+.**

**Research findings (2025-2026):**
- `tauri-plugin-process` provides `exit()` and `relaunch()` via `process:allow-exit` and `process:allow-relaunch` capabilities.
- The plugin is coordinated with Tauri releases (all plugins bumped to v2.2.0 together).

**Codebase assessment:** There is no settings system in the current app (0.1.0). There is no use case for `relaunch()` today — and the YAGNI principle applies. `exit()` could be used in the About view for a clean quit button, but `Close window` from the OS is equivalent.

**Action: LOW priority / DEFER. Do not add until a settings page that requires restart is built.**

---

### ✅ 8. `tracing` + `tracing-subscriber` (Rust)

**dep.md claim**: "387M+ downloads. Clearly superior to [log](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewDashboard.tsx#171-175) crate for async. 2025 standard."

**Verdict: ✅ TECHNICALLY CORRECT — but has a significant Tauri-specific complication.**

**Research findings (2025-2026):**
- `tracing` is the async-native Tokio-team standard. Provides spans, structured fields, and async context propagation that the [log](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewDashboard.tsx#171-175) crate fundamentally cannot offer.
- **However**: `tauri-plugin-log` is built on the [log](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewDashboard.tsx#171-175) facade — it accepts `log::info!()` → routes to stdout/file/webview. Adding `tracing` alongside it requires `tracing-log` as a compatibility shim to forward tracing events to the log facade.
- `tauri-plugin-tracing` exists separately and enables advanced Tauri + tracing integration with span visualization, but is separate from `tauri-plugin-log`.
- The current project uses `log::{info, debug, warn, error}` in 8 Rust modules (verified in [helpers.rs](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src-tauri/src/helpers.rs), `commands/*.rs`). All 8 already pass through `tauri-plugin-log` to stdout + file + webview targets.

**Codebase assessment:** The current [log](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewDashboard.tsx#171-175) + `tauri-plugin-log` setup is working, passing all quality gates, and covers the real observability needs at v0.1.0. The `tracing` migration would require: (1) adding `tracing + tracing-subscriber + tracing-log`, (2) replacing all `log::info!()` with `tracing::info!()` across all modules, (3) re-integrating with `tauri-plugin-log` via the compat shim.

This is a meaningful refactor for a tangential benefit at current scale. The benefit becomes real when concurrent async tasks (parallel partition extraction) need span-level tracing — which is a future need, not present.

**Action: LOW priority. Keep [log](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewDashboard.tsx#171-175) crate for now. Revisit when genuinely async-heavy operations need span tracing.**

---

### ✅ 9. `tokio` (full features, Rust)

**dep.md claim**: "Already used under Tauri internally. Explicitly adding gives direct access to async process spawning and task management."

**Verdict: ✅ CONFIRMED — and there's a specific, valid reason to add it.**

**Research findings (2025-2026):**
- Tauri 2 bundles and initializes a Tokio runtime. `tauri::async_runtime::spawn()` re-exports key Tokio functions. For most use cases, the re-export is sufficient.
- Best practice: Add `tokio` as an explicit [Cargo.toml](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src-tauri/Cargo.toml) dependency **only when you need features not re-exported by `tauri::async_runtime`** — e.g., `tokio::sync::mpsc`, `tokio::time::timeout`, `tokio::sync::RwLock`.
- The payload extractor already uses `tauri::async_runtime::spawn_blocking()` for the parallel extraction thread scope. This works today without explicit `tokio` in [Cargo.toml](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src-tauri/Cargo.toml).

**Codebase assessment:** `payload/extractor.rs` uses `std::thread::scope` for parallel partition extraction — a sync thread model, not async. [commands/payload.rs](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src-tauri/src/commands/payload.rs) uses `tauri::async_runtime::spawn_blocking`. No direct `tokio::` usage exists. The current approach is correct per Tauri docs.

**When you'd actually need explicit tokio:**
- Streaming extraction progress updates via `tokio::sync::mpsc` channels (vs polling).
- `tokio::time::timeout` for commands that might hang (ADB can deadlock on disconnected devices).
- `tokio::sync::RwLock` for shared mutable state across async tasks.

**Action: LOW priority. Add `tokio = { version = "1", features = ["full"] }` only when you use a specific tokio primitive the tauri re-export doesn't cover. Do not add speculatively.**

---

### ✅ 10. `regex` (Rust)

**dep.md claim**: "Battle-tested. Standard for parsing ADB command output."

**Verdict: ✅ CONFIRMED — but the codebase doesn't actually use regex yet, and may not need it.**

**Research findings (2025-2026):**
- `regex` crate is stable, performant, and battle-tested. For ADB outputs (device list, package list, `getprop`), it's the pragmatic choice.
- **Alternative**: For production-grade parsing of complex or evolving ADB output, `nom` (parser combinators) offers better structured output + error reporting.
- **The YAGNI angle**: Current parsing in [helpers.rs](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src-tauri/src/helpers.rs) uses `.split_whitespace()`, `.lines()`, `.strip_prefix()`, `.split(':')`, `.split('/')` — all stdlib string operations. No regex is needed for current parsing tasks.

**Codebase evidence:**
```rust
// helpers.rs - get_ip_address: pure stdlib parsing
.split_whitespace().collect::<Vec<_>>().windows(2)
    .find_map(|chunk| (chunk[0] == "inet").then_some(chunk[1]))

// commands/apps.rs - package list: strip_prefix, no regex needed
.filter_map(|line| line.trim().strip_prefix("package:"))
```

All current parsing is simple and handled cleanly without regex. Adding `regex` speculatively violates YAGNI. If logcat filtering or complex `adb devices -l` parsing is added later, then `regex` (or `nom` for complex grammars) becomes justified.

**Action: DO NOT ADD YET. Add `regex` only when a specific parsing need exceeds stdlib string ops.**

---

## Dev Tooling

### ✅ 11. `vitest` + `@testing-library/react`

**dep.md claim**: "Fully confirmed with React 19 + Vite 8. Standard testing setup in 2025."

**Verdict: ✅ CONFIRMED — and this is a MUST-DO gap in the project.**

**Research findings (2025-2026):**
- Vitest 3.x is fully compatible with Vite 8 and React 19. Configuration is minimal (`vitest.config.ts` with `jsdom` environment, `@testing-library/react` + `@testing-library/user-event`).
- This is the undisputed 2025 standard for Vite-based React testing.
- The `pnpm check` pipeline currently has 8 Rust tests but **zero JS/TS tests** — a hard gap listed in the memory bank as [activeContext.md](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/memory-bank/activeContext.md) and [progress.md](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/memory-bank/progress.md).

**Setup packages needed:**
```
vitest @testing-library/react @testing-library/user-event jsdom @vitest/coverage-v8
```

**Immediate candidate tests:**
- `ConnectedDevicesCard` — renders device list, handles empty state
- `TerminalLogPanel` — renders log entries, filters by level
- [errorHandler.ts](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/lib/errorHandler.ts) — [handleError()](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/lib/errorHandler.ts#4-13), [handleSuccess()](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/lib/errorHandler.ts#14-18) unit tests (pure functions, easy to isolate)
- [payloadDumperStore.ts](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/lib/payloadDumperStore.ts) — Zustand store action tests (toggle, markCompleted)

**Action: HIGH priority. The only critical gap in the entire test coverage story.**

---

### ⚠️ 12. `@biomejs/biome` (Dev tooling)

**dep.md claim**: "⚠️ Does not have an equivalent for `eslint-plugin-react-hooks` exhaustive-deps. Keep optional."

**Verdict: ⚠️ DEP.MD WAS OUTDATED — Biome 2.0 (March 2025) now HAS the rule.**

**Research findings (2025-2026):**
- **Biome 2.0 (released March 2025)** added `lint/correctness/useExhaustiveDependencies` — a direct equivalent to `eslint-plugin-react-hooks/exhaustive-deps`. This is available since Biome 1.0 but matured in 2.0.
- Biome 2.0 also added: plugin system, type-aware linting, multi-file analysis.
- **Remaining practical consideration**: Biome's `useExhaustiveDependencies` still has behavioral differences from ESLint's version (e.g., previously it flagged `useState` setters as unnecessary deps, which ESLint does not — being addressed).
- Migrating from ESLint 10 + `eslint-plugin-react-hooks` to Biome would require: configuration migration, verifying rule parity for all currently enabled rules (14 ESLint rules active), and replacing `Prettier` (which Biome also replaces). This is a non-trivial migration with risk.

**The dep.md caveat is now partially outdated, but migration risk remains real.** The current ESLint 10 flat config setup is modern and working well with zero lint warnings on `pnpm check`.

**Action: KEEP DEP.MD RECOMMENDATION — do not migrate. Update the dep.md note to reflect Biome 2.0 has the rule but migration risk still outweighs marginal benefit.**

---

## Actionable Recommendations (Priority-Ordered)

| Priority | Action | Rationale |
|----------|--------|-----------|
| 🔴 **HIGH** | Add `vitest` + `@testing-library/react` | Zero FE test coverage is the biggest quality gap. Easy to add, immediate value. |
| 🔴 **HIGH** | Add `zod` (v4) | Input safety for IP/port/command fields with minimal bundle impact. YAGNI satisfied — these forms exist now. |
| 🟡 **MEDIUM** | Add `@tanstack/react-query` v5 | Eliminates duplicated device polling across 3 views. Replaces 150+ lines of boilerplate. |
| 🟡 **MEDIUM** | Add `react-hook-form` + `@hookform/resolvers` | Pair with zod for the wireless ADB form and shell command form. |
| 🟡 **MEDIUM** | Add `@tauri-apps/plugin-clipboard-manager` | One-click copy for device info. Minimal integration effort, high UX payoff. |
| 🟢 **LOW** | Add `@tauri-apps/plugin-notification` | OS notifications for payload extraction completion. Deferred until polling is refactored. |
| ⏸️ **DEFER** | Add `@tauri-apps/plugin-process` | No settings page exists yet. YAGNI applies. |
| ⏸️ **DEFER** | Add `tracing` + `tracing-subscriber` | Current [log](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src/components/views/ViewDashboard.tsx#171-175) + `tauri-plugin-log` is working. Worth revisiting when async complexity grows. |
| ⏸️ **DEFER** | Add `tokio` explicitly | Tauri's re-export is sufficient today. Add only when a specific tokio primitive is needed. |
| ❌ **DO NOT ADD** | `@tauri-apps/plugin-shell` | ADB is already spawned in Rust via [helpers.rs](file:///c:/Users/akila/OneDrive/Desktop/OSS/WindowsApps/adb-gui-next/src-tauri/src/helpers.rs). Adding shell plugin duplicates logic and widens attack surface. |
| ❌ **DO NOT ADD (yet)** | `regex` | All current ADB output parsing uses stdlib string ops. Add only when a specific complex parsing need arises. |
| 📝 **UPDATE** | dep.md Biome entry | Biome 2.0 (March 2025) now has `useExhaustiveDependencies`. Update caveat but keep recommendation to not migrate. |

---

## Implementation Sequence (When Ready)

```bash
# Step 1: Test coverage (immediate)
pnpm add -D vitest @testing-library/react @testing-library/user-event jsdom @vitest/coverage-v8

# Step 2: Input validation (immediate)
pnpm add zod@^4

# Step 3: Form management (with zod)
pnpm add react-hook-form @hookform/resolvers

# Step 4: Query + clipboard (medium term)
pnpm add @tanstack/react-query
pnpm add @tauri-apps/plugin-clipboard-manager
# + Cargo.toml: tauri-plugin-clipboard-manager = "2"
# + capabilities: "clipboard-manager:allow-write-text"

# Step 5: Notifications (medium term, pair with RQ refactor)
pnpm add @tauri-apps/plugin-notification
# + Cargo.toml: tauri-plugin-notification = "2"
# + capabilities: "notification:default"
```

---

## dep.md Accuracy Assessment

| Entry | dep.md Status | Actual Status (2026-03-22) |
|-------|--------------|---------------------------|
| TanStack Query v5 | ✅ Correct | ✅ Confirmed + verified |
| zod | ✅ Correct (v3) | ✅ Upgrade to v4 |
| react-hook-form | ✅ Correct | ✅ + note useWatch caveat |
| plugin-shell | ✅ "Required" | ❌ NOT needed — architecture mismatch |
| plugin-notification | ✅ Correct | ✅ v2.3.3 (updated from 2.2.2) |
| plugin-clipboard-manager | ✅ Correct | ✅ v2.3.2 confirmed |
| plugin-process | ✅ Correct | ⏸️ Defer — no use case exists yet |
| tracing + tracing-subscriber | ✅ Correct | ⚠️ Works but complicates tauri-plugin-log |
| tokio | ✅ Correct | ⏸️ Defer — tauri re-export is sufficient |
| regex | ✅ Correct | ❌ Not needed — stdlib ops sufficient |
| vitest + @testing-library | ✅ Correct | ✅ HIGH PRIORITY — add now |
| Biome | ⚠️ Outdated caveat | ⚠️ Rule exists in Biome 2.0 but migration risk still real |
