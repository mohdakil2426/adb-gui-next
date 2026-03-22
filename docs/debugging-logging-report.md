# Debugging & Logging Comprehensive Report

> **KISS Principle**: Keep solutions simple, practical, and easy to maintain.
> **Deep Analysis**: 5 parallel subagents analyzed entire codebase (80 tool calls).

---

## Executive Summary

ADB GUI Next has **zero logging framework** and **inconsistent error handling** across frontend and backend. The project has strong quality gates (lint, format, build) but significant gaps in debugging infrastructure.

**Current Score**: 4/10
**Target Score**: 8/10
**Estimated Effort**: ~8 hours

---

## Critical Findings

### Backend (Rust) — 6 Critical Issues

| # | Issue | Location | Severity |
|---|-------|----------|----------|
| 1 | **No logging framework** | Entire backend | 🔴 Critical |
| 2 | **Generic error messages** | `helpers.rs:78,84,89` | 🔴 Critical |
| 3 | **`.unwrap()` in production** | `payload/extractor.rs:82` | 🔴 Critical |
| 4 | **`.expect()` in parsing** | `payload/parser.rs:18,24,28` | 🟡 High |
| 5 | **Silent error handling** | `helpers.rs:147-155` | 🟡 High |
| 6 | **No error categories** | `CmdResult<T>` | 🟡 High |

**Example — Generic Error Messages**:
```rust
// helpers.rs:89 — Which binary? What path?
fs::metadata(_path).map_err(|error| error.to_string())?;

// helpers.rs — Which command failed?
Err(format!("{binary} command failed."))
```

**Example — Production `.unwrap()`**:
```rust
// payload/extractor.rs:82 — Thread panic crashes app
handles.into_iter().map(|h| h.join().unwrap()).collect()
```

### Frontend (React/TypeScript) — 5 Critical Issues

| # | Issue | Location | Severity |
|---|-------|----------|----------|
| 1 | **3 inconsistent error patterns** | All views | 🔴 Critical |
| 2 | **Silent catch blocks** | Dashboard, Utilities, Flasher | 🔴 Critical |
| 3 | **No debug mode** | Entire frontend | 🟡 High |
| 4 | **No performance timing** | All async operations | 🟡 High |
| 5 | **Log panel lacks filters** | `TerminalLogPanel.tsx` | 🟢 Medium |

**Pattern A — Silent failures** (hides bugs):
```typescript
// ViewDashboard.tsx:76
catch (error) {
  console.error('Error refreshing devices:', error);
  setDevices([]); // Silent state reset
}
```

**Pattern B — Toast but no persistent log**:
```typescript
// ViewAppManager.tsx:59
catch (error) {
  console.error('Failed to load packages:', error);
  toast.error('Failed', { description: String(error) });
  // Missing: useLogStore.getState().addLog(...)
}
```

**Pattern C — Full logging** (only in some places):
```typescript
// ViewDashboard.tsx:97
catch (error) {
  toast.error('Failed', { id: toastId, description: String(error) });
  useLogStore.getState().addLog(`Failed: ${error}`, 'error');
}
```

### Testing & Tooling Gaps

| Area | Status | Gap |
|------|--------|-----|
| Rust tests | ✅ 8 tests | Payload only |
| Frontend tests | ❌ None | No Vitest/Jest |
| Integration tests | ❌ None | No E2E |
| Code coverage | ❌ None | No tooling |
| Debug mode | ❌ None | No verbose logging |
| Performance timing | ❌ None | No metrics |

---

## Recommendations (KISS-Ordered)

### Phase 1: Foundation (2 hours) — High Impact

#### 1.1 Add Tauri Log Plugin (30 min)

```bash
cd src-tauri && cargo add tauri-plugin-log
```

```rust
// src-tauri/src/lib.rs
use tauri_plugin_log::{Builder as LogBuilder, LevelFilter, Target, TargetKind};

tauri::Builder::default()
    .plugin(
        LogBuilder::new()
            .level(LevelFilter::Info)
            .targets([
                Target::new(TargetKind::Stdout),
                Target::new(TargetKind::LogDir { file_name: None }),
                Target::new(TargetKind::Webview),
            ])
            .build()
    )
```

```rust
// Use in helpers.rs
use log::{info, debug, error};

info!("Binary resolved: {:?}", path);
debug!("Running: {} {:?}", binary, args);
error!("Command failed: {}", stderr);
```

```typescript
// Use in frontend
import { info, error, debug } from '@tauri-apps/plugin-log';

await info('User clicked flash button');
await error(`Flash failed: ${err}`);
```

#### 1.2 Improve Rust Error Context (1 hour)

**Before**:
```rust
Err(format!("{binary} command failed."))
```

**After**:
```rust
Err(format!("{binary} {:?} failed (exit {}): {}", args, status, stderr.trim()))
```

**Pattern**: Every error must answer: **What? Why? With what input?**

Replace all `.unwrap()` with proper error handling:
```rust
// Before (extractor.rs:82)
handles.into_iter().map(|h| h.join().unwrap()).collect()

// After
handles.into_iter().map(|h| h.join().map_err(|e| format!("Thread panicked: {:?}", e))).collect()
```

#### 1.3 Standardize Frontend Error Handling (30 min)

Create `src/lib/errorHandler.ts`:
```typescript
import { toast } from 'sonner';
import { useLogStore } from './logStore';
import { error as logError } from '@tauri-apps/plugin-log';

export function handleError(context: string, err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const fullMessage = `[${context}] ${message}`;

  logError(fullMessage).catch(console.error);
  useLogStore.getState().addLog(fullMessage, 'error');
  toast.error(context, { description: message });

  return fullMessage;
}

export function handleSuccess(context: string, message: string): void {
  useLogStore.getState().addLog(`[${context}] ${message}`, 'success');
}
```

### Phase 2: Developer Experience (3 hours) — Medium Impact

#### 2.1 Add Debug Mode (30 min)

Create `src/lib/debug.ts`:
```typescript
const isDebug = import.meta.env.DEV || localStorage.getItem('debug') === 'true';

export function debugLog(...args: unknown[]): void {
  if (isDebug) console.log('[DEBUG]', ...args);
}

export function enableDebugMode(): void {
  localStorage.setItem('debug', 'true');
}
```

#### 2.2 Add Performance Timing (1 hour)

```typescript
export async function timedOp<T>(name: string, op: () => Promise<T>): Promise<T> {
  const start = performance.now();
  debugLog(`→ ${name}`);
  try {
    const result = await op();
    debugLog(`✓ ${name} (${(performance.now() - start).toFixed(0)}ms)`);
    return result;
  } catch (err) {
    debugLog(`✗ ${name} (${(performance.now() - start).toFixed(0)}ms)`);
    throw err;
  }
}
```

#### 2.3 Enhance Log Panel (1.5 hours)

Add to `TerminalLogPanel.tsx`:
- Log level filter dropdown (All/Error/Warning/Info)
- Search input for filtering logs
- Timestamps with milliseconds
- Export as JSON option

### Phase 3: Testing & CI (3 hours) — Long-term Value

#### 3.1 Add Vitest for Frontend (2 hours)

```bash
pnpm add -D vitest @testing-library/react @testing-library/jest-dom
```

#### 3.2 Add Code Coverage (1 hour)

```bash
pnpm add -D @vitest/coverage-v8
```

---

## Implementation Roadmap

| Phase | Tasks | Time | Impact |
|-------|-------|------|--------|
| **1** | Log plugin + Error context + Frontend handler | 2 hours | 🔴 High |
| **2** | Debug mode + Timing + Log panel | 3 hours | 🟡 Medium |
| **3** | Vitest + Coverage | 3 hours | 🟡 Medium |

**Total**: ~8 hours

---

## Quick Wins (Do Today)

1. Add `RUST_BACKTRACE=1` to `pnpm dev` script
2. Replace all `.unwrap()` in `payload/extractor.rs` with `.map_err()`
3. Create `errorHandler.ts` and use in all views
4. Add `debugLog()` at key operations

---

## Anti-Patterns to Eliminate

| Anti-Pattern | Found In | Fix |
|--------------|----------|-----|
| `.unwrap()` in production | `extractor.rs:82` | `.map_err()` |
| `.expect()` in parsing | `parser.rs:18,24,28` | Return `Result` |
| Silent catch blocks | Dashboard, Utilities, Flasher | Use `handleError()` |
| Generic errors | `helpers.rs` | Include context |
| `String(error)` | All views | Use `error.message` |

---

## Skill Violations (m06-error-handling)

| Violation | Skill Guideline | Code Location |
|-----------|-----------------|---------------|
| `.unwrap()` | "Use `?` or match" | `extractor.rs:82` |
| Lost context | "Add `.context()`" | `helpers.rs:78,84,89` |
| Generic errors | "What does caller need?" | `helpers.rs` command errors |
| No error categories | "Result<T, E> with typed E" | `CmdResult<T>` |

---

## References

- [Tauri Log Plugin](https://v2.tauri.app/plugin/logging)
- [Tauri Debugging](https://v2.tauri.app/develop/debug)
- [m06-error-handling](.agents/skills/m06-error-handling/)
- [Rust Error Handling](https://doc.rust-lang.org/book/ch09-02-recoverable-errors.html)

---

*Generated: 2026-03-22 | ADB GUI Next v0.1.0 | Deep Analysis: 5 subagents, 80 tool calls*