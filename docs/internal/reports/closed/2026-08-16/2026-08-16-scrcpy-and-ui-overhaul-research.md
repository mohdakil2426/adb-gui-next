# Research: Scrcpy + UI overhaul (2026-08-16)

**Repo:** ADB GUI Next (Tauri 2)  
**Branch/worktree:** `feat/scrcpy-and-ui-overhaul`  
**Sources:** official Genymobile/scrcpy docs and v4.1 release assets, shadcn/ui theming, GitHub Actions hardening guidance, Android `pm`/`dumpsys`/`ls`, existing codebase.

This document is the design spec the implementation plan executes. User is unavailable; decisions below are locked.

---

## A) Scrcpy integration

### Official distribution (chosen)

Genymobile documents **prebuilt official release archives** as the first-class install path:

| OS | Official asset (v4.1, 2026-07-12) | Notes |
| --- | --- | --- |
| Windows x64 | `scrcpy-win64-v{ver}.zip` | Primary first-class |
| Windows x86 | `scrcpy-win32-v{ver}.zip` | Available; we can use for 32-bit hosts |
| Linux x86_64 | `scrcpy-linux-x86_64-v{ver}.tar.gz` | Static build; official linux.md |
| macOS aarch64 | `scrcpy-macos-aarch64-v{ver}.tar.gz` | Code path for future; builds paused |
| macOS x86_64 | `scrcpy-macos-x86_64-v{ver}.tar.gz` | Same |
| Server-only | `scrcpy-server-v{ver}` | Bundled inside the archives; do not vendor source |

**Not shipped by official releases:** Linux arm64, Windows arm64. For those hosts: fall back to PATH `scrcpy` if present; otherwise show an explicit “no official binary for this arch” state. Do not download random third-party builds (official README warning).

**Rejected:** scoop / winget / apt / brew as the *app-managed* path. They require extra host tools, produce unversioned PATH collisions with our bundled ADB, and are not offline-after-first-download in app data. Package managers remain a *user* option; the app downloads the official zip/tarball itself.

**Checksums:** each release publishes `SHA256SUMS.txt` + `SHA256SUMS.txt.asc` (GPG, Romain Vimont). We **must** verify SHA-256 of the chosen asset against `SHA256SUMS.txt`. GPG verify is optional (no bundled keyring UX); SHA-256 is the required gate. Source: [verify-release.md](https://github.com/Genymobile/scrcpy/blob/master/doc/verify-release.md).

**Update flow:** `GET https://api.github.com/repos/Genymobile/scrcpy/releases/latest` (User-Agent required; 403/429 → surface “rate limited, retry later”). Compare `tag_name` to installed `version.txt`. Download to temp → sha256 → extract to `scrcpy-{ver}/` → atomic rename over `current` → write version file. Never extract over a live binary.

**Install location:** `app_data_dir()/scrcpy/` (Tauri `path().app_data_dir()`), not resources (resources are read-only in installed builds). Layout:

```text
{appData}/scrcpy/
  current/          # extracted binary dir (scrcpy.exe / scrcpy)
  version.txt       # e.g. v4.1
  download.tmp      # in-flight
```

**Launch:** native `std::process::Command`, **detached** (Windows `DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP`; Unix `process_group(0)`), stdin/stdout/stderr null. **Not** embedded in the webview. Pass `-s {serial}` when a device is selected. Set env `ADB` to our `resolve_binary_path(adb)` so scrcpy uses the same ADB we already manage ([connection.md](https://github.com/Genymobile/scrcpy/blob/master/doc/connection.md)). Working directory = extracted `current/` so `scrcpy-server` is found beside the binary.

**Do not** clone or compile scrcpy source. Do not wrap a custom protocol.

### Feature surface (CLI flags only)

Catalog from official user docs + `scrcpy.1` (v4.x). UI exposes a curated subset; the domain maps 1:1 to argv.

| UI | Flag |
| --- | --- |
| Serial | `-s` / `--serial` |
| Max size | `-m` / `--max-size` |
| Video bit rate | `-b` / `--video-bit-rate` |
| Max FPS | `--max-fps` |
| Video codec | `--video-codec` (`h264`/`h265`/`av1`/`vp8`/`vp9`) |
| No audio | `--no-audio` |
| Audio source | `--audio-source` |
| Stay awake | `--stay-awake` (`-w`) |
| Turn screen off | `--turn-screen-off` (`-S`) |
| Show touches | `--show-touches` (`-t`) |
| Fullscreen | `--fullscreen` (`-f`) |
| Always on top | `--always-on-top` |
| Borderless | `--window-borderless` |
| Record path | `-r` / `--record` |
| Record format | `--record-format` |
| Keyboard | `--keyboard=` (`sdk`/`uhid`/`aoa`/`disabled`) |
| Control off | `--no-control` (`-n`) |

Everything else stays out of v1 UI (camera, V4L2, OTG, virtual display) — YAGNI.

### IPC (thin commands)

| Command | Role |
| --- | --- |
| `scrcpy_status` | installed version, binary path, latest known tag (cached) |
| `scrcpy_check_update` | GitHub latest + compare |
| `scrcpy_install` | download+verify+extract (progress event) |
| `scrcpy_launch` | spawn detached with flag DTO |
| `scrcpy_list_editors` | n/a (file explorer) |

Event: `scrcpy:download-progress` `{ received, total, stage }`.

Permissions: add to `allow-device-read` (status/check) and `allow-device-mutate` (install/launch) **and** `allow-all`.

---

## B) Dashboard

Existing `get_device_telemetry` already batches getprop + battery + meminfo + df + ip + uptime + root + selinux + wifi. `getprop` dumps the **whole** table, so extra identity fields are free (no extra adb spawn):

Add to `DeviceIdentity`: `manufacturer`, `hardware`, `fingerprint`, `incremental`, `locale`, `timezone`, `radio`.

Do **not** add a second donut on Dashboard. `PackageCompositionDonut` already lives in App Manager and answers “user vs system vs listed”. Dashboard already has BatteryGauge, UsageBar, MemorySparkline, PartitionSizeChart. Extra pie would duplicate storage bars.

Motion: keep `--motion-*` + `transform`/`opacity` only; `LazyMotion`/`m` already in shell. Identity card fade-in on telemetry arrival is enough.

---

## C) App icons (Rust)

**Why previous FE attempts fail:** pulling/parsing APKs in the webview is too slow, CSP/asset-protocol fights, and `freezePrototype` forbids charting-adjacent image libs. Labels already work via on-device `label_reader.jar`; icons were never extracted in Rust.

**Chosen pipeline (no aapt, no scrcpy source):**

1. `pm list packages -f` → `package:/path/base.apk=com.foo` (path includes install id → cache key).
2. Disk cache: `{app_cache}/app-icons/{serial-hash}/{sha256(path)}.png|webp` + memory LRU.
3. On miss: `adb pull` that APK to a temp file (serial-targeted).
4. Open as ZIP (`zip` crate already in tree). Prefer raster in `res/mipmap-{xxxhdpi,xxhdpi,xhdpi,hdpi,mdpi,anydpi}/` then `res/drawable-*` named `ic_launcher*`, `icon*`. Skip `.xml` adaptive icons unless a referenced raster exists in the same zip.
5. Return `{ packageName, mime, dataBase64 }` (small; xxhdpi launcher ~4–20 KB). FE displays `data:` URLs only.

**Work profile:** `pm list packages --user 0` is default; extra users skipped in v1 unless `-f` already includes them. System apps: same path (`/system/app` or `/data/app`); some have no raster → FE placeholder.

**Perf:** IPC `get_app_icons(serial, packages: Vec<String>)` **max 24** per call. FE virtualizer requests visible rows only. Never pull all packages at once.

**Invalidation:** cache key is the APK path string from `-f`. Reinstall changes the path.

`apk-info-axml` is already a Cargo dep but unused — optional for icon resource id; heuristic zip scan is the reliable v1 (adaptive XML is the common miss).

---

## D) File explorer

`list_files` already uses `ls -lA` (hidden included) in both normal and root modes. Confirm parser keeps names starting with `.` (it does — no filter). Add a unit test with a `.config` directory.

**Open in editor:** pull to owned temp (`{temp}/adb-gui-next-editors/`) then spawn:

| OS | Preference order |
| --- | --- |
| Windows | `code` (PATH) → `notepad.exe` |
| Linux | `code` → `xdg-open` (covers gedit/kate via desktop) |
| macOS (future) | `code` → `open -t` (TextEdit) |

Allowlist extensions: `.sh .md .txt .toml .xml .bak .json .conf .prop .log .cfg .ini .yaml .yml .properties .rc .service`. Refuse archives/binaries. Snapshot serial **before** any host dialog. Reuse existing pull + `FileAccessMode`.

---

## E) Marketplace

Rust already owns search/detail/install. Gaps:

- `get_detail` only loads **latest** release; `list_releases` is `per_page=20` and **one APK per tag**.
- No README fetch.

**Fix in Rust:** paginate `/releases?per_page=100` until empty (cap 10 pages). Emit **every** APK asset (not debug/aab/xapk). `GET /repos/{owner}/{repo}/readme` with `Accept: application/vnd.github.raw` → `readmeMarkdown` on detail (rate-limit: skip with empty string). FE: simple markdown renderer (headings, lists, code, links) — **no new markdown library** (prototype-write risk). Install path unchanged.

UI: keep container queries; tighten filter/search chrome; versions list shows all APKs.

---

## F) Utilities

Reimagine as grouped cards: Power, Server, Diagnostics, Danger. Extra justified tools (all existing ADB/fastboot, no new protocols):

- `adb reconnect` / `usb` / `tcpip` already covered by wireless flow
- Logcat snapshot: `adb logcat -d -t 200` via existing `run_adb_host_command` or a thin domain helper
- `adb get-state`
- Screenshot already elsewhere? If not, `screencap -p` pull — **only if** a command already exists; else skip to avoid duplicate of scrcpy

Danger: wipe / kill-server / recovery / bootloader already have `ConfirmDialog`. Keep and add copy that names the serial.

---

## G) Adaptive layout

All new/changed screens: `@container` on the view root; `@lg`/`@xl`/`@2xl`/`@4xl` only. Never `sm:`/`md:` viewport. Existing Dashboard trio grid is the reference.

---

## H) GitHub Actions

Current `ci.yml` already: `permissions: contents: read`, concurrency cancel, SHA-pinned actions, path filters, LFS on package. **Beneficial, not overengineered:**

- `persist-credentials: false` on checkout (supply-chain default).
- Pin `dtolnay/rust-toolchain` is `@stable` by design (floating); leave it — SHA-pinning that action to an old commit freezes the toolchain unexpectedly.
- Do **not** add CodeQL/ Harden-Runner in this pass (scope).

---

## I) Theme

Official shadcn Neutral (oklch chroma 0). User wants **true black** dark canvas:

| Token | Light (shadcn Neutral) | Dark (true black Neutral) |
| --- | --- | --- |
| canvas | `oklch(1 0 0)` | `oklch(0 0 0)` |
| surface | `oklch(1 0 0)` | `oklch(0.145 0 0)` |
| surface-raised | `oklch(0.97 0 0)` | `oklch(0.205 0 0)` |
| surface-overlay | `oklch(1 0 0)` | `oklch(0.269 0 0)` |
| primary | `oklch(0.205 0 0)` | `oklch(0.985 0 0)` |
| foreground | `oklch(0.145 0 0)` | `oklch(0.985 0 0)` |

Status colours stay chromatic (device state). Tokens only in `global.css`. Rename palette comments from “Precision Instrument” to “Neutral”.

---

## J) FE logic that belongs in Rust

| Found | Action |
| --- | --- |
| Marketplace GitHub release/readme shaping | Keep/move in `marketplace/github.rs` |
| Scrcpy argv building | Rust domain, never FE string concat of flags beyond DTO |
| Icon extraction | New `app_icons` domain |
| Editor spawn + pull | Rust `commands/files` + small helper |
| Dashboard formatting | Stays FE (`format.ts`) — already correct |
| Debloat composition donut math | Tiny FE derived state — OK (pure from DTOs) |

---

## References

- https://github.com/Genymobile/scrcpy — official source warning
- https://github.com/Genymobile/scrcpy/blob/master/doc/windows.md
- https://github.com/Genymobile/scrcpy/blob/master/doc/linux.md
- https://github.com/Genymobile/scrcpy/blob/master/doc/macos.md
- https://github.com/Genymobile/scrcpy/blob/master/doc/verify-release.md
- https://github.com/Genymobile/scrcpy/releases/tag/v4.1
- https://ui.shadcn.com/docs/theming — Neutral OKLCH
- https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions
- Android `pm list packages -f`, `ls -lA`
