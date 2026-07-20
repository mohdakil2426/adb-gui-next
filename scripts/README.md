# Scripts

Helper scripts for packaging prep and emulator-root development. They are **not** part of the end-user app binary.

App versioning uses official Tauri: `src-tauri/tauri.conf.json` → `"version": "../package.json"`. Installer builds use **`tauri-apps/tauri-action`** in CI/publish.

---

## Inventory

| Script | Purpose | When |
| --- | --- | --- |
| [`make-windows-portable.ps1`](./make-windows-portable.ps1) | Build Windows **portable zip** after a Tauri release build | CI/publish (Windows jobs) or local after `tauri build` |
| [`sync-cargo-version.mjs`](./sync-cargo-version.mjs) | Set `Cargo.toml` version from `package.json` (app SoT) | Before release: `bun run version:sync` |
| [`download-darwin-tools.ps1`](./download-darwin-tools.ps1) | Download Google platform-tools into `src-tauri/resources/darwin/` | macOS tools refresh (macOS product builds remain paused by policy) |
| [`emulator-root-diagnostics.ps1`](./emulator-root-diagnostics.ps1) | Collect emulator root status into a markdown report | Manual debug when Emulator Root misbehaves |
| [`emulator-root-e2e.ps1`](./emulator-root-e2e.ps1) | End-to-end AVD root test via upstream rootAVD | Manual QA of root pipeline on a real AVD |

---

## Packaging

### `make-windows-portable.ps1`

Tauri has **no official portable bundle type**. This script packages:

- Built `adb-gui-next.exe` (renamed to `ADB GUI Next.exe`)
- `src-tauri/resources/windows/` (platform-tools + DLLs)
- `README-portable.txt` (run instructions, WebView2 / OneDrive notes)

**Requires (after a successful Windows build):**

| Parameter | Example |
| --- | --- |
| `-Version` | `0.2.5` |
| `-Arch` | `x86_64` \| `i686` \| `aarch64` (matches tauri-action `[arch]`) |
| `-TargetTriple` | `x86_64-pc-windows-msvc` |
| `-OutputZip` | path to `…-portable.zip` |

Validates PE arch of the app and bundled `adb.exe` before zipping.

**Example (local):**

```powershell
./scripts/make-windows-portable.ps1 `
  -Version 0.2.5 `
  -Arch x86_64 `
  -TargetTriple x86_64-pc-windows-msvc `
  -OutputZip ./artifacts/ADB-GUI-Next-v0.2.5-windows-x86_64-portable.zip
```

### `sync-cargo-version.mjs`

```bash
bun run version:sync
# or: bun scripts/sync-cargo-version.mjs
```

Writes `src-tauri/Cargo.toml` `version` to match `package.json`. Required because Tauri app version is official path `../package.json` but Cargo still needs its own field.

### `download-darwin-tools.ps1`

Downloads [Google Android platform-tools for macOS](https://dl.google.com/android/repository/platform-tools-latest-darwin.zip) and copies them into `src-tauri/resources/darwin/`.

Run from the **repo root**. No parameters.

```powershell
./scripts/download-darwin-tools.ps1
```

macOS shipping stays **paused** unless product policy unpauses it; this only refreshes in-tree tools.

---

## Emulator root (dev / QA)

These scripts use a **real local Android SDK + AVD**. They are not run by default CI package jobs.

### `emulator-root-diagnostics.ps1`

**Read-oriented:** runs adb probes against a booted emulator and writes a markdown report (default under `docs/reports/`).

| Parameter | Default |
| --- | --- |
| `-Serial` | `emulator-5554` |
| `-AvdName` | `Medium_Phone` |
| `-OutputPath` | auto timestamped path under `docs/reports/` |

```powershell
./scripts/emulator-root-diagnostics.ps1 -Serial emulator-5554 -AvdName Medium_Phone
```

Use when the in-app Emulator Root wizard fails and you need a snapshot of device state (props, su, workdirs, ramdisk paths, etc.).

### `emulator-root-e2e.ps1`

**Write / destructive on the AVD image path:** restores stock ramdisk from `.backup`, cold-boots the AVD, runs upstream **rootAVD** (`docs/refrences/github-repos/rootAVD` or equivalent local path), then checks Magisk-related outcome.

| Parameter | Default |
| --- | --- |
| `-Serial` | `emulator-5554` |
| `-AvdName` | `Medium_Phone` |

**Needs:** Android SDK emulator, AVD with ramdisk backup, rootAVD scripts, network/SDK layout as expected by the script.

```powershell
./scripts/emulator-root-e2e.ps1 -Serial emulator-5554 -AvdName Medium_Phone
```

Do **not** run against an AVD you are not willing to re-root or restore.

---

## Notes

- Prefer **bundled** `src-tauri/resources/windows/adb.exe` when present; scripts fall back to system `adb` if missing.
- Emulator scripts assume a **Windows** host with a typical `%LOCALAPPDATA%\Android\Sdk` layout.
- Keep this folder focused: packaging helpers + emulator-root tooling only.
