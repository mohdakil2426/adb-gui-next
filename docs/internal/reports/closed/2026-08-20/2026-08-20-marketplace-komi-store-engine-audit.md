# Marketplace Architecture Audit & Komi Store Engine Integration

**Date**: 2026-08-20  
**Status**: Approved & Implemented  
**Scope**: Rust Backend (`src-tauri/src/marketplace/`), Frontend UI Layer (`src/features/marketplace/`), IPC Bridges (`src/desktop/`)

---

## 1. Executive Summary

A comprehensive investigation into the `adb-gui-next` marketplace domain identified critical failure modes and performance bottlenecks:
1. **GitHub 404 App Detail Crash**: Curated tools and update candidates store Android reverse-DNS package IDs (e.g., `com.pittvandewitt.viperfx`, `moe.shizuku.privileged.api`, `com.topjohnwu.magisk`). When opening app details under the GitHub source, the backend queried `https://api.github.com/repos/{package_id}`, resulting in `HTTP 404 Not Found` and leaving the frontend in a broken state.
2. **Missing Releases for Pre-release Projects**: Projects publishing only pre-releases (e.g., Lawnchair 14 Beta) returned 404 on `/releases/latest`, stripping APK download links and rendering apps non-installable.
3. **Termux Official APK Filter Bug**: `is_apk_asset` filtered out filenames containing `debug`. Official Termux GitHub releases (`termux-app_v0.118.1+github-debug_arm64-v8a.apk`) were systematically excluded.
4. **README Engine Absence & Markdown Fragility**: README fetching lacked raw CDN fallback and relative asset resolution (converting `./docs/image.png` to raw GitHub CDN and `./LICENSE` to blob links). The frontend line-by-line regex parser failed on tables, images, raw HTML, code blocks, blockquotes, and lists.
5. **No ABI Prioritization**: Assets were selected naively via `first()`, potentially downloading `x86` or `debug` builds instead of optimized `arm64-v8a` or `universal` binaries.

By incorporating architectural patterns from [Komi Store](https://github.com/kurikomi-labs/komi-store) (`kurikomi-labs/komi-store`), we engineered a high-performance, Rust-centric resolution, markdown, and asset pipeline.

---

## 2. Architectural Blueprint & Komi Store Patterns

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Frontend React 19 UI                          │
│  - AppDetailView (Hero, Screenshots, GFM Markdown Prose, Version List) │
│  - SearchBar & FilterBar (Debounced, Virtualized, Cached)             │
│  - Error Boundaries & Graceful Fallback Banners                       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ IPC (Tauri 2 Invoke)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Rust Service Coordinator                        │
│                         (src-tauri/src/marketplace/)                   │
│                                                                        │
│   ┌────────────────────────┐         ┌─────────────────────────────┐   │
│   │   Repository Resolver   │ ◄───────┤   Known Curated Registry    │   │
│   │   (Package ID <-> Repo)│         │   (ViPER4Android, Shizuku..)│   │
│   └───────────┬────────────┘         └─────────────────────────────┘   │
│               │                                                        │
│   ┌───────────▼────────────┐         ┌─────────────────────────────┐   │
│   │  GitHub Engine (Multi) │ ◄───────┤  Release Asset Classifier   │   │
│   │  - /releases/latest    │         │  - ABI Prioritization       │   │
│   │  - /releases fallback  │         │  - Alpine APK exclusion     │   │
│   │  - raw CDN fallback    │         │  - Clean flavor fingerprint │   │
│   └───────────┬────────────┘         └─────────────────────────────┘   │
│               │                                                        │
│   ┌───────────▼────────────┐         ┌─────────────────────────────┐   │
│   │  README Markdown Engine│ ────────┤  Relative URL Rewriter      │   │
│   │  - Dual-path fetcher   │         │  - Images -> raw.github...  │   │
│   │  - GFM Parser & Sanitize│        │  - Links -> github.../blob  │   │
│   └────────────────────────┘         └─────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

### Core Components Added:

1. **Repository Resolver (`resolver.rs`)**:
   - Maps Android package IDs (`com.pittvandewitt.viperfx`) to GitHub repository slugs (`v4a-re/ViPER4Android-FX`).
   - Supports bi-directional resolution, URL parsing, and search heuristics.
   - Prevents naive `api.github.com/repos/{package_id}` lookups.

2. **README Markdown & Asset Engine (`markdown.rs` / `github.rs`)**:
   - **Dual-Path Fetching**: Primary GitHub API `/readme` with `Accept: application/vnd.github.raw` -> Fallback to `raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}` across `.github/`, root `""`, `docs/`, `doc/` for `README.md`, `README.markdown`, `README.rst`, `README`.
   - **Relative URL Transformation**: Automatically rewrites relative markdown image tags `![alt](rel_path)` and HTML `<img src="rel_path">` to raw GitHub CDN URLs on the repository's default branch. Rewrites relative links `[text](rel_path)` to GitHub blob view URLs.
   - **HTML Tag Flattening & Sanitization**: Flattens nested `<details>/<summary>` tags, normalizes CRLF line endings, and strips tracking badges.

3. **Release Asset & Variant Classifier (`assets.rs`)**:
   - **ABI Prioritization**: `arm64-v8a` (100) > `universal/all` (80) > `armeabi-v7a` (60) > `x86_64` (40) > `x86` (20).
   - **Alpine Linux APK Filter**: Excludes Alpine package manager `.apk` assets (`.apk` targeting alpine architectures with no Android signatures).
   - **Termux & Debug Release Fix**: Allows `+github-debug` and similar production debug variant tags when they are official releases.
   - **Pre-Release Fallback**: If `/releases/latest` returns 404, gracefully queries the first available release from `/releases`.

4. **Frontend Detail & Markdown UI (`AppDetailView.tsx`, `ReadmeMarkdown.tsx`)**:
   - Resilient in-page error boundary with retry action.
   - Enhanced Markdown prose renderer supporting tables, task lists, blockquotes, syntax-styled code blocks, and badges.
   - Synchronized store navigation.

---

## 3. Verification Matrix

| Test Scenario | Expected Outcome | Status |
|---|---|:---:|
| ViPER4Android FX Detail Lookup | Package ID `com.pittvandewitt.viperfx` resolves to `v4a-re/ViPER4Android-FX`, loads v2.7.2.1 APK and README | Verified |
| Shizuku / Magisk Detail Lookup | Package IDs resolve to `RikkaApps/Shizuku` and `topjohnwu/Magisk` with full README and assets | Verified |
| Lawnchair 14 (Pre-release only) | Fallback to latest pre-release fetches `v14-beta2` APK and changelog | Verified |
| Termux APK Recognition | `termux-app_v0.118.1+github-debug_arm64-v8a.apk` accepted as valid installable APK | Verified |
| Markdown Relative Images | `./assets/banner.png` rendered as `https://raw.githubusercontent.com/...` | Verified |
| Markdown Tables & Lists | Formatted cleanly with Tailwind typography | Verified |
