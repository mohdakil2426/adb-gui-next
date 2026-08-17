# GitHub Actions CI efficiency audit + rating (free runners)

**Date:** 2026-07-18  
**Scope:** `.github/workflows/ci.yml`, `publish.yml`, free GitHub-hosted runners, dependency currency  
**Status:** Audit + ratings + **session changes applied** (path-filter job split still backlog)  
**Sources:** Live workflows; [GitHub path filters](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#onpushpull_requestpull_request_targetpathspaths-ignore); [skipping runs](https://docs.github.com/en/actions/managing-workflow-runs/skipping-workflow-runs); team decision: **keep dual Package (Linux + Windows)**

---

## 0. Session changes applied (this workstream)

| Change | Where | Result |
| --- | --- | --- |
| Payload CI red fix | `src-tauri/src/payload/tests/mod.rs` | TransactionGuard tests match “files only, keep dir”; ZIP64 test `#[ignore]` (deferred) |
| Bun pin | `ci.yml`, `publish.yml`, `package.json` `packageManager` | **1.3.14** (match local) |
| FE deps | `bun update --latest` | Tauri api **2.11.1**, cli **2.11.4**, TypeScript **^7.0.2**, etc. |
| Rust lockfile | `cargo update` | Latest compatible crates under current `Cargo.toml` |
| Ultracite / Biome | Tried 7.9.4 / 2.5.4 | **Reverted** to **7.7.0 / 2.4.15** — Biome 2.5.4 panics on this repo |
| Dual OS Package | Design decision | **Keep** — native installers need OS-native runners |

**Not applied yet:** path-aware triggers, FE/Rust Quality split, package-only-on-product-paths.

Local verify (deps session): `lint:web` clean, **192/192** Vitest, Vite build OK. Windows `cargo test` may still hit known loader `0xc0000139`; CI Linux is authority for Rust tests.

---

## 1. Current pipeline (as committed design)

| Job | When | What | Free runner |
| --- | --- | --- | --- |
| **Quality** | Every push (any branch) + PR → main | format, lint FE+Rust, Vitest, cargo test, Vite build | `ubuntu-22.04` |
| **Package linux-x64** | After Quality; **main push only** | Tauri deb/rpm + artifact | `ubuntu-22.04` |
| **Package windows-x64** | After Quality; **main push only** | Tauri nsis/msi + artifact | `windows-latest` |
| **Publish** | Manual `workflow_dispatch` | Preflight + multi-OS release + draft GH release | Ubuntu + Windows (+ macOS if secrets) |

**Already good:** concurrency + `cancel-in-progress`, Bun cache, `swatinem/rust-cache`, package after Quality, package only on `main`, `permissions: contents: read` on CI.

**Why two Package jobs (keep):** GitHub free runners are **one OS per job**. Linux installers need Linux; Windows installers need Windows. Parallel jobs beat one sequential “both OS” fantasy. Not a bug.

---

## 2. Pipeline rating (GitHub free runners)

### 2.1 Overall

| Area | Score (1–10) | Grade | Note |
| --- | --- | --- | --- |
| **Whole pipeline** | **7.0** | **B** | Solid Tauri CI; waste on non-code pushes; fat Quality |
| **Safety / correctness** | **8.0** | **A−** | Real tests before package |
| **Speed / cost (free minutes)** | **5.5** | **C+** | Dual Package parallel is good; always-full Quality hurts |
| **Clarity** | **7.5** | **B+** | Clear names; FE+Rust mixed in one job |
| **Caching** | **8.0** | **A−** | Bun + rust-cache + cancel |
| **Release path** | **8.0** | **A−** | Manual publish, draft, optional macOS |
| **Smart triggers** | **4.0** | **D+** | No path filters yet |
| **Free-runner fit** | **8.0** | **A−** | Correct OS matrix; no paid larger runners required |

### 2.2 Job-by-job

| Job | Score | Keep? | Note |
| --- | --- | --- | --- |
| Quality (single) | 7.0 | Keep idea | Correct gates; always FE+Rust = overpay |
| Package linux-x64 | **8.5** | **Keep** | Right OS + parallel |
| Package windows-x64 | **8.5** | **Keep** | Right OS + parallel |
| Publish preflight | 8.0 | Keep | Manual gate before ships |
| Publish build matrix | 8.0 | Keep | Same dual-OS truth |
| Publish draft release | 8.5 | Keep | Checksums + draft |

### 2.3 Design choices

| Choice | Score | Verdict |
| --- | --- | --- |
| Dual Package (Linux + Windows) | **9/10** | **Keep forever** on free runners |
| Package after Quality | **9/10** | Keep |
| Package only `main` push | **8/10** | Keep |
| Concurrency cancel-in-progress | **9/10** | Keep |
| Always full CI every push | **4/10** | Improve (path / detect) |
| One Quality job FE+Rust | **6/10** | OK now; split later for free minutes |
| ubuntu-22.04 pin | **7/10** | Fine; 24.04 only after Tauri smoke |

### 2.4 Projected score after path smarts only (Package still dual)

| Area | Now | After path filters + package-if-product |
| --- | --- | --- |
| Overall | 7.0 | **~8.0–8.5** |
| Speed / cost | 5.5 | **~7.5** |
| Smart triggers | 4.0 | **~8.5** |

---

## 3. Free GitHub-hosted runner constraints (audit)

| Constraint | What it means for us |
| --- | --- |
| **1 job = 1 OS** | Cannot build Windows MSI on Ubuntu (reliably) — dual Package is correct |
| **Minute billing** | Private repos: shared free minutes; public: different limits — still avoid waste |
| **Concurrent jobs** | Free tier concurrency limited; dual Package uses 2 slots (acceptable) |
| **No persistent disks** | Caches (Bun/rust) are the main speed lever — already used |
| **Max job time** | Package timeout 120m is fine for Tauri |
| **Artifact storage** | 14-day retention OK; compression-level 0 = larger upload, less CPU |
| **macOS minutes** | Scarcer/more expensive; Publish skips macOS without secrets (good) |

**Do not “optimize” by:** single Windows job that “also makes Linux packages”, or dropping `cargo test` on free runners.

---

## 4. Findings (still open)

| ID | Finding | Impact on free minutes |
| --- | --- | --- |
| F1 | No path-aware skip for non-code pushes | Full Quality (+ Package on main) wasted |
| F2 | Package on every successful Quality on main | Non-product main pushes still ship installers |
| F3 | Single Quality always FE+Rust | FE-only or Rust-only still pays both |
| F4 | Quality + Package reinstall deps / rebuild | Extra minutes (trade for reliability) |
| F5 | Path-skip + required check = Pending | Only if branch protection requires skipped workflow |

---

## 5. Target Actions summary (product code vs non-code)

Keep dual Package. Smart skip only.

| Change type | Free-runner jobs that should run |
| --- | --- |
| Non-code only (`**/*.md`, guides, etc.) | Tiny **ci-gate** success; Quality/Package **skipped** |
| `src/**` only | Quality (frontend) on Ubuntu; Package only if main+product rule |
| `src-tauri/**` only | Quality (rust) on Ubuntu; Package if product rule |
| Product on **main** | Quality needed sides → **Package linux** + **Package windows** **parallel** |
| Manual Publish | Preflight → dual OS builds (+ macOS optional) → draft release |

**Always treat as code:** `src/**`, `src-tauri/**`, lockfiles, `package.json`, workflow YAML, `scripts/**`, biome/vite/tsconfig.

---

## 6. Improvement backlog (free runners only)

| P | Item | Free-minute win | Risk |
| --- | --- | --- | --- |
| **P0** | detect-changes / path filter → skip heavy jobs on non-code | High | Required-check Pending if misconfigured |
| **P0** | Package only when product paths change on main | High | Miss package if filter too tight |
| **P1** | Split Quality frontend vs rust | Medium–High | More YAML |
| **P1** | Keep dual Package parallel | — | None — already correct |
| **P2** | Optional shared FE dist artifact into package jobs | Medium | Cache invalidation bugs |
| **P2** | ubuntu-24.04 after Tauri verify | Low | WebKit package names |
| **P2** | `workflow_call` reuse Quality from Publish | Maintainability | None |
| **Avoid** | Sequential one-job multi-OS package | Negative | Slow + wrong OS |

---

## 7. Dependency currency (session)

| Area | Outcome |
| --- | --- |
| React / Vite / Vitest / Query / Zustand | At/near latest via `bun update --latest` |
| `@tauri-apps/api` / `cli` | **2.11.1** / **2.11.4** |
| TypeScript | **^7.0.2** (build verified) |
| Bun | **1.3.14** in CI + packageManager |
| Cargo.lock | Updated compatible crates |
| Ultracite / Biome | **Stay 7.7.0 / 2.4.15** until Biome 2.5.x stable on this tree |

---

## 8. Success criteria

1. Non-code commit → no Package; no full dual-stack Quality (or green gate only).  
2. Product `main` push → Quality + **both** Package jobs (parallel).  
3. Dual OS Package remains (free-runner correct design).  
4. Required checks never stuck Pending when work is intentionally skipped.  
5. Deps green: lint, tests, build (and Linux `cargo test` on CI).

---

## 9. Out of scope / do not

- Merging Linux+Windows package into one free-runner job  
- Dropping Rust tests for green CI  
- Blind Biome 2.5 / Ultracite 7.9 until upstream panic fixed  
- Committing disposable `temp-ci-summary.md` or local `.codegraph/`

---

## 10. Follow-up

| Item | Status |
| --- | --- |
| Dual Package keep decision | **Locked** |
| Dep bumps + Bun pin + payload test fix | **Applied / this commit set** |
| Path filters + FE/Rust split | **Next implementation** |
| Re-score after path filters | Expect overall **~8.0–8.5** |
