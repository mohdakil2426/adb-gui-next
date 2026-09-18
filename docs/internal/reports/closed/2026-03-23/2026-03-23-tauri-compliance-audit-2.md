# ADB GUI Next — Tauri 2 Full Compliance Audit

> **Sources**: [v2.tauri.app](https://v2.tauri.app) · [tauri-apps/tauri-docs](https://github.com/tauri-apps/tauri-docs) (v2 branch)  
> **Audited**: 2026-03-23 · **All fixes applied** · **Final score: 100%**

---

## Audit Summary

| #   | Category                                     | Before                   | After        | Severity |
| --- | -------------------------------------------- | ------------------------ | ------------ | -------- |
| 1   | Security — CSP                               | ❌ `null` (disabled)     | ✅ Fixed     | HIGH     |
| 2   | Security — HTTP Headers                      | ✅ N/A                   | ✅ N/A       | —        |
| 3   | Capabilities & Permissions                   | ✅ Compliant             | ✅ Compliant | —        |
| 4   | Rust Commands & IPC Pattern                  | ✅ Compliant             | ✅ Compliant | —        |
| 5   | Command Naming Convention                    | ✅ Compliant             | ✅ Compliant | —        |
| 6   | Dead Code — `greet` command                  | ❌ Present               | ✅ Removed   | MEDIUM   |
| 7   | State Management (Rust)                      | ✅ Compliant             | ✅ Compliant | —        |
| 8   | Plugin Initialization                        | ✅ Compliant             | ✅ Compliant | —        |
| 9   | `lib.rs` / Builder Pattern                   | ✅ Compliant             | ✅ Compliant | —        |
| 10  | `Cargo.toml` — Release Profile               | ⚠️ Missing               | ✅ Added     | LOW      |
| 11  | `Cargo.toml` — Version Pinning               | ⚠️ Inconsistent          | ✅ Fixed     | LOW      |
| 12  | `tauri.conf.json` — Build Config             | ✅ Compliant             | ✅ Compliant | —        |
| 13  | `tauri.conf.json` — Window Config            | ✅ Compliant             | ✅ Compliant | —        |
| 14  | `tauri.conf.json` — Bundle Config            | ✅ Compliant             | ✅ Compliant | —        |
| 15  | `tauri.conf.json` — Schema                   | ✅ Compliant             | ✅ Compliant | —        |
| 16  | Vite Config — `envPrefix`                    | ❌ Missing               | ✅ Added     | MEDIUM   |
| 17  | Vite Config — Build Targets                  | ❌ Missing               | ✅ Added     | MEDIUM   |
| 18  | Vite Config — Chunk Splitting                | ⚠️ 589KB warning         | ✅ Fixed     | MEDIUM   |
| 19  | Frontend IPC Layer                           | ✅ Compliant             | ✅ Compliant | —        |
| 20  | TypeScript DTOs vs Rust Structs              | ✅ Compliant             | ✅ Compliant | —        |
| 21  | Mobile Entry Point                           | ✅ Compliant             | ✅ Compliant | —        |
| 22  | React Strict Mode                            | ✅ Compliant             | ✅ Compliant | —        |
| 23  | ESLint / Fast Refresh                        | ✅ Fixed (prev. session) | ✅ Compliant | —        |
| 24  | `save_log` — hardcoded relative path         | ❌ Bug                   | ✅ Fixed     | MEDIUM   |
| 25  | Platform Guards (`#[cfg]`)                   | ✅ Compliant             | ✅ Compliant | —        |
| 26  | `ensure_executable_if_needed` — missing `fs` | ❌ Linux compile bug     | ✅ Fixed     | HIGH     |
| 27  | Logging Strategy                             | ✅ Compliant             | ✅ Compliant | —        |
| 28  | Resource Bundling                            | ✅ Compliant             | ✅ Compliant | —        |

---

## Quality Gates (Post-Fix)

```
pnpm lint:web          →  ✅  0 problems, 0 warnings
pnpm lint:rust         →  ✅  0 warnings, 0 errors (-D warnings)
pnpm format:check      →  ✅  Prettier + cargo fmt clean
pnpm build             →  ✅  tsc + vite: 0 errors, 0 warnings
```

---

## Section 1 — Security: Content Security Policy (CSP)

### ✅ FIXED

**Official Tauri 2 Docs** (https://v2.tauri.app/security/csp/):

> _"The CSP protection is only enabled if set in the Tauri configuration file. You should make it as restricted as possible… At compile time, Tauri appends its nonces and hashes to the relevant CSP attributes automatically."_

**Before**: `"csp": null` — bypassed all CSP, no XSS protection, no nonce injection.

**After** (`src-tauri/tauri.conf.json`):

```json
"security": {
  "csp": {
    "default-src": "'self' ipc: http://ipc.localhost asset: http://asset.localhost",
    "connect-src": "ipc: http://ipc.localhost",
    "img-src": "'self' asset: http://asset.localhost data: blob:",
    "style-src": "'unsafe-inline' 'self'",
    "script-src": "'self'"
  }
}
```

**Why `'unsafe-inline'` in `style-src`**: Tailwind CSS v4 injects runtime `<style>` blocks.  
**Why `ipc:` + `http://ipc.localhost`**: Required for Tauri IPC to function.  
**Why `asset:` + `http://asset.localhost`**: Required for local asset loading.

---

## Section 3 — Capabilities & Permissions

### ✅ COMPLIANT

`capabilities/default.json` follows least-privilege correctly:

- Only exact permissions granted — no wildcards
- `core:default` + `opener:default` + `dialog:default` + clipboard read/write only
- Correct `$schema` + `windows: ["main"]` format

---

## Section 4 — Rust Commands & IPC Pattern

### ✅ COMPLIANT

All 28 commands (after removing `greet`) follow the official pattern:

- `#[tauri::command]` + `CmdResult<T>` (alias for `Result<T, String>`) ✅
- `generate_handler![commands::*]` registration ✅
- camelCase argument keys on both Rust and TypeScript sides ✅
- All invoced exclusively via `backend.ts` abstraction ✅

---

## Section 6 — Dead Code: `greet` Command

### ✅ REMOVED (3 files)

The scaffold template `greet` command was removed from:

1. `src-tauri/src/commands/system.rs` — function deleted
2. `src-tauri/src/lib.rs` — removed from `generate_handler![]`
3. `src/lib/desktop/backend.ts` — `Greet()` wrapper deleted

---

## Section 10 — `Cargo.toml`: Release Profile

### ✅ ADDED

Official Tauri docs (https://v2.tauri.app/concept/size/) recommend:

```toml
[profile.dev]
incremental = true      # Faster incremental compiles

[profile.release]
codegen-units = 1       # Better LLVM optimisation
lto = true              # Link Time Optimisation
opt-level = "s"         # Smaller binary (use "3" for speed)
panic = "abort"         # No unwinding overhead
strip = true            # Remove debug symbols
```

---

## Section 16-18 — Vite Config: Build Optimisations

### ✅ FIXED (`vite.config.ts`)

All three missing items from the official Tauri Vite template added:

**1. `envPrefix`** — exposes `TAURI_ENV_*` to `import.meta.env`:

```typescript
envPrefix: ['VITE_', 'TAURI_ENV_*'],
```

**2. Platform-targeted build** — Tauri uses Chromium on Windows, WebKit on others:

```typescript
build: {
  target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
  minify: process.env.TAURI_ENV_DEBUG ? false : ('esbuild' as const),
  sourcemap: !!process.env.TAURI_ENV_DEBUG,
}
```

**3. Manual chunks** — splits 589KB single bundle into cacheable vendor chunks:

```typescript
manualChunks(id: string) {
  if (id.includes('node_modules')) {
    if (id.includes('react-dom') || ...) return 'react-vendor';
    if (id.includes('framer-motion')) return 'motion';
    if (id.includes('@tauri-apps')) return 'tauri';
    if (id.includes('@tanstack')) return 'query';
    if (id.includes('@radix-ui') || id.includes('radix-ui')) return 'radix';
  }
}
```

**Result** — bundle breakdown after fix:

| Chunk              | Size (uncompressed) |
| ------------------ | ------------------- |
| `index` (app code) | 254 KB              |
| `react-vendor`     | 212 KB              |
| `motion`           | 136 KB              |
| `radix`            | 112 KB              |
| `query`            | 59 KB               |
| `tauri`            | 19 KB               |

No chunk exceeds 600KB. No size warnings.

---

## Section 24 — `save_log`: Hardcoded Relative Path

### ✅ FIXED

**Before**: Wrote to `./logs` relative to process CWD — undefined in packaged Tauri apps.

**After** (`commands/system.rs`):

```rust
let logs_dir = app.path().app_log_dir().map_err(|e| e.to_string())?;
```

Logs now write to the official platform log directory:

- **Windows**: `%APPDATA%\com.akila.adbguinext\logs`
- **Linux**: `~/.local/share/com.akila.adbguinext/logs`

---

## Section 26 — `ensure_executable_if_needed`: Missing `fs` Import

### ✅ FIXED

**Before**: `fs::metadata()` used inside `#[cfg(target_family = "unix")]` block without `use std::fs` — compiles on Windows but fails on Linux.

**After** (`helpers.rs`):

```rust
#[cfg(target_family = "unix")]
{
    use std::fs;                           // scoped — only imported on Unix
    use std::os::unix::fs::PermissionsExt;
    // ... rest unchanged
}
```

Scoping the import inside the cfg block means clippy on Windows doesn't flag it as unused.

---

## What Was Already Correct (No Changes Needed)

| Area                  | Detail                                                                            |
| --------------------- | --------------------------------------------------------------------------------- |
| **Capabilities**      | Minimal least-privilege grants, correct schema and format                         |
| **IPC layer**         | `backend.ts` wraps all `invoke()` calls — no scattered direct calls               |
| **DTO alignment**     | All TypeScript interfaces match Rust `#[serde(rename_all = "camelCase")]` structs |
| **`lib.rs` builder**  | Uses `.build()` + `.run()` with `RunEvent` cleanup handler                        |
| **Plugin init**       | All 4 plugins use correct init pattern                                            |
| **Logging**           | `Info` level, three targets (Stdout, LogDir, Webview)                             |
| **`#[cfg]` guards**   | Windows/Linux specific code correctly gated                                       |
| **`crate-type`**      | `["staticlib", "cdylib", "rlib"]` — standard Tauri 2 required trio                |
| **Mobile entry**      | `#[cfg_attr(mobile, tauri::mobile_entry_point)]` present                          |
| **React Strict Mode** | Enabled in `main.tsx`                                                             |
| **Resource bundling** | Platform-split config with three-tier binary resolution                           |
| **TSConfig**          | Strict mode, `verbatimModuleSyntax`, module resolution correct                    |

---

_Generated 2026-03-23 · All findings from official Tauri 2 documentation at https://v2.tauri.app_
