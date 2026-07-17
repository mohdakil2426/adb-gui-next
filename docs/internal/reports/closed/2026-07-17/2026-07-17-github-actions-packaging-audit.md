# GitHub Actions & Packaging Audit Report

| Field | Value |
| --- | --- |
| **Date** | 2026-07-17 |
| **Mode** | Analysis + remediation plan (implementation separate) |
| **Workflows** | `.github/workflows/ci.yml`, `publish.yml` |
| **Packaging** | Tauri 2 NSIS/MSI/portable, deb/rpm, collect-release-assets.ps1 |
| **Failed run** | [29603116118](https://github.com/mohdakil2426/adb-gui-next/actions/runs/29603116118) |

---

## 1. Failed CI after audit push (root cause)

| Field | Detail |
| --- | --- |
| **Run** | CI on `main` after `524f724` |
| **Jobs** | Linux + Windows both failed |
| **Step** | `Check formatting` → `bun run format:check` → `format:rust:check` |
| **Root cause** | Rust sources not rustfmt-clean (`cargo fmt --check` diffs). Not a logic/test failure. |
| **Skipped** | Lint, tests, Vite build, Tauri package, artifact upload |
| **Fix** | `bun run format:rust` (or full format) so `format:check` passes |

Touched / dirty style files included audit paths (`commands/debloat.rs`, `payload/*`, etc.) and older payload modules that still needed rustfmt.

---

## 2. CI workflow findings (efficiency)

| Sev | Finding | Recommendation |
| --- | --- | --- |
| Critical | Full `tauri build` + artifact upload on **every** branch push and PR | **Quality only** off-main; package + upload **only on `main`** |
| Critical | Format/lint/test/Vite duplicated on Linux **and** Windows matrix | Single Ubuntu quality job; package matrix separate |
| High | No Bun install cache | Cache Bun store keyed by `bun.lock` |
| High | No job timeouts | Set `timeout-minutes` |
| High | Docs-only pushes still run full pipeline | Path filters and/or main-only packaging |
| Medium | apt reinstall every Linux run | Keep explicit apt; optional cache later |
| Medium | Publish hard-requires Apple secrets | Optional macOS; never block Win/Linux |
| Medium | Publish preflight weaker than CI (no clippy/cargo test) | Align with full quality |
| Low | Actions major tags not SHAs | Optional pin later |

### Target CI shape (product decision)

```text
quality (ubuntu)     — every push/PR: format, lint, test, cargo test, vite build
package (win+linux)  — only if: github.ref == refs/heads/main (and not skipped by paths)
                       tauri build + collect + upload-artifact
```

---

## 3. Packaging findings (Win/Linux first)

| Sev | Finding | Recommendation |
| --- | --- | --- |
| Critical | Publish fails entirely without Apple secrets | Optional macOS job |
| Critical | No `tauri.macos.conf.json` for darwin resources | Drop macOS from default publish or add conf |
| High | No Windows Authenticode | Document / future signing plan |
| Medium | Portable zip is custom (good); ensure WebView2 README stays | Keep |
| Medium | CI Linux missing chmod +x on bundled tools (publish has it) | Parity in package job |
| Low | Naming `AdbGuiNext-v{ver}-…` is good | Keep |
| Info | Version triple 0.2.5 consistent | Keep verify script |

Official refs: Tauri 2 Windows installer / Linux bundles; GHA dependency caching; Swatinem/rust-cache.

---

## 4. Strengths already present

- Least-privilege permissions; concurrency cancel on CI
- rust-cache with `workspaces: './src-tauri -> target'`
- Windows `cargo test --no-run` vs Linux full tests
- Version verify; stale bundle cleanup; fail-closed artifact upload
- Draft release + SHA256SUMS on publish

---

## 5. Remediation status (implemented, uncommitted)

| Item | Status |
| --- | --- |
| rustfmt / format:check | Done |
| CI quality job (all branches/PRs) | Done — single Ubuntu |
| CI package + upload **main push only** | Done |
| Bun cache + rust-cache + timeouts | Done |
| Publish: full quality preflight | Done |
| Publish: macOS optional (secrets soft-detect) | Done |
| Publish: Win/Linux always | Done |
| Commits | **None** (user request) |

### Post-change CI behavior

| Event | Quality | Package + artifacts |
| --- | --- | --- |
| Feature branch push | Yes (Ubuntu) | No |
| PR → main | Yes (Ubuntu) | No |
| Push to `main` | Yes → then package Win+Linux | Yes |
| Publish workflow | Preflight quality | Win+Linux always; macOS if secrets |
