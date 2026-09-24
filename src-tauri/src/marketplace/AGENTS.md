# Marketplace Backend Guide

Backend marketplace engine (`src-tauri/src/marketplace/`) handling package discovery, GitHub releases, F-Droid, Aptoide, ABI ranking, streaming downloads via `install_queue`, SWR caching, and OS keychain auth. Parent: `src-tauri/AGENTS.md`.

## Architecture & Invariants

- Multi-provider queries (GitHub, F-Droid, Aptoide) with package ID resolver.
- ABI ranking: arm64-v8a > universal > armeabi-v7a > x86_64 > x86.
- SWR memory cache (`cache.rs`) returning stale entries rather than blocking.
- OS keychain (`keyring` crate) token persistence; PAT is session-only in memory.
- Streaming APK downloads via `install_queue` emitting throttled progress events.

## Rules & Traps (Ponytail Ultra Format)

- **Wrong:** using `tempfile::NamedTempFile::new()` which creates extensionless files (`.tmpXXXXXX`) that `adb install -r` rejects.
  **Right:** use `tempfile::Builder::new().suffix(".apk").tempfile_in(dir)` because ADB strictly requires `.apk` or `.apex` extension.
  **Id:** Marketplace ADB APK extension
- **Wrong:** persisting OAuth tokens in plaintext files or keeping only in memory across restarts.
  **Right:** persist OAuth tokens securely in OS keychain via `keyring` crate and keep personal access tokens (PAT) session-only in memory.
  **Id:** Marketplace credential persistence
