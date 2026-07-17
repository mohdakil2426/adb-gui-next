# CI & Packaging Remediation Plan

> **For agentic workers:** Execute task-by-task. **No git commits** unless the user asks.

**Goal:** Fix rustfmt CI failure; make workflows efficient and robust; **package/upload artifacts only on `main`**; other branches run quality only (format, lint, test, build frontend/Rust checks). Focus Windows + Linux; macOS optional for publish.

**Status (2026-07-18):** Implemented and ready to commit.
- `cargo fmt --all`; `format:check` green
- `ci.yml`: quality (ubuntu) all branches; package matrix **main push only**
- `publish.yml`: full preflight quality; Win/Linux always; macOS only if secrets present
- Bun install cache + timeouts + Linux chmod on package
- Rust `[lints]` + `clippy.toml` (max non-extreme bar); `lint:rust` green
- Husky: `lint:web` + `format:check`

**Architecture:** Split CI into `quality` (Ubuntu) + `package` (matrix, main-only). Publish: preflight quality; Win/Linux always; macOS only when secrets present.

**Tech Stack:** GitHub Actions, Bun, Rust, Tauri 2

---

### Task 1: rustfmt

- [ ] Run `cargo fmt --manifest-path src-tauri/Cargo.toml --all`
- [ ] Verify `bun run format:check` passes

### Task 2: Rewrite `ci.yml`

- [ ] Job `quality` on `ubuntu-22.04` (or 24.04 if deps OK — stick to 22.04 for known webkit packages)
  - checkout, setup-bun + **Bun cache**, rust-toolchain (rustfmt+clippy), rust-cache
  - `bun ci`, release:verify, format:check, lint, test, cargo test, bun run build
  - timeouts
- [ ] Job `package` matrix windows + linux
  - `if: github.ref == 'refs/heads/main' && github.event_name == 'push'`
  - needs: quality
  - NO full lint/test suite again (optional: only bun ci + rust + tauri build)
  - chmod linux tools; tauri build; collect; upload-artifact
- [ ] Keep PR/push quality on all branches without artifacts

### Task 3: Rewrite `publish.yml` (Win/Linux first)

- [ ] Preflight: full quality (lint web+rust, cargo test, FE test, format, version)
- [ ] Apple secret check: **do not fail whole workflow** — set output `macos_enabled`
- [ ] Build matrix: always linux + windows; macos only if enabled
- [ ] Bun cache; timeouts; chmod; align apt with CI

### Task 4: Docs touch (memory-bank / report status)

- [ ] Note in audit report that remediation implemented (no commit required)

### Task 5: Local verify

- [ ] format:check, lint:web if needed
- [ ] Validate YAML structure

---

**Product rule (user):**

| Branch / event | Quality (lint/test/format) | Tauri package + artifact upload |
| --- | --- | --- |
| Feature branches / PRs | Yes | **No** |
| `main` push | Yes | **Yes** |
| Publish workflow | Yes (preflight) | Yes (Win/Linux; macOS optional) |
