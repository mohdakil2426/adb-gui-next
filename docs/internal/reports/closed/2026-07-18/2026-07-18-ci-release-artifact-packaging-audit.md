# CI Artifact, Release Build & Packaging Identity Audit

| Field | Value |
| --- | --- |
| **Date** | 2026-07-18 |
| **Category** | `audit` |
| **Mode** | Audit + **follow-up apply** (2026-07-18 evening) |
| **App version audited** | `0.2.5` |
| **Branch** | `main` |
| **Scope** | CI package jobs, publish/release builds, artifact naming, installer/zip names, post-install app identity, Windows/Linux (macOS paused), bitness/portable, accidental-deletion safety, multi-arch matrix |
| **Method** | Parallel explore subagents + live workflow/config/script reads + official Tauri 2 / GitHub Actions docs + PE inspection of bundled `adb.exe` |

---

## 0. Executive summary

| Verdict | Detail |
| --- | --- |
| **Overall** | **Sound for Windows/Linux x64 first-class shipping.** Version triple is consistent; CI packages only on `main`; publish is manual + draft-only; cleanup is limited to build/staging dirs (not user install paths). |
| **Highest risks** | (1) Docs/product drift on **macOS**, (2) **missing `tauri.macos.conf.json`** while darwin tools + optional DMG exist, (3) **no Windows Authenticode**, (4) naming surface is multi-style (`AdbGuiNext` / `Adb Gui Next` / `ADB GUI Next` / `adb-gui-next`), (5) **x64-only** — no 32-bit / ARM Win-Linux matrix. |
| **Accidental deletion** | **Low risk** for end-user data from packaging pipelines. Deletes target `src-tauri/target/.../bundle` and collect-script portable staging only. |
| **Portable** | **Custom Windows zip** (not a Tauri bundle target). Layout is intentional and matches runtime dual-path resolver. |

**Do not confuse:** this audit is about **host packaging of the desktop app**, not Android device wipe/flash safety.

---

## 1. Official baselines (fetched, not memory)

Findings below are cross-checked against current official sources:

| Topic | Official source |
| --- | --- |
| Tauri config: `productName`, `identifier`, `version`, `mainBinaryName`, bundle targets, platform conf merge | [Tauri 2 Configuration](https://v2.tauri.app/reference/config/) |
| Windows NSIS/MSI, 32-bit (`i686-pc-windows-msvc`), ARM64, WebView2 install modes, NSIS `installMode` | [Windows Installer](https://v2.tauri.app/distribute/windows-installer/) |
| Debian packaging limits (glibc / Ubuntu 22.04 baseline), ARM cross-compile | [Debian](https://v2.tauri.app/distribute/debian/) |
| RPM packaging / scripts / depends | [RPM](https://v2.tauri.app/distribute/rpm/) |
| Bundle types (`deb`, `rpm`, `appimage`, `nsis`, `msi`, `app`, `dmg`) — **no official “portable” bundle type** | [BundleType in config ref](https://v2.tauri.app/reference/config/) |
| Platform-specific conf merge (`tauri.windows.conf.json`, `tauri.linux.conf.json`, `tauri.macos.conf.json`) | [Platform-Specific Configuration](https://v2.tauri.app/reference/config/) |
| GitHub Actions artifact upload, `retention-days`, immutability of v4 artifacts | [Store and share data with workflow artifacts](https://docs.github.com/en/actions/tutorials/store-and-share-data), [upload-artifact v4 behavior](https://github.blog/news-insights/product-news/get-started-with-v4-of-github-actions-artifacts/) |

### Official rules that matter for this project

1. **`productName`** = app name used for branding/bundling; **`identifier`** (reverse-DNS) must be unique (webview data dir, system configs).  
2. **`mainBinaryName`** optional override; default binary comes from Cargo package name unless set.  
3. Tauri compiles for the **host architecture by default**; 32-bit / ARM require explicit `--target` (e.g. `i686-pc-windows-msvc`, `aarch64-pc-windows-msvc`).  
4. **NSIS default install mode is current-user** (`%LOCALAPPDATA%`) unless `bundle.windows.nsis.installMode` is set to `perMachine` or `both`.  
5. **Default WebView2 mode** is `downloadBootstrapper` (needs network on first install if runtime missing). Win10/11 usually already have WebView2.  
6. Linux: build on **old-enough** base with WebKitGTK 4.1 (Ubuntu **22.04** / Debian 12 recommended) to avoid high glibc floors.  
7. Official bundle targets do **not** include a first-class “portable zip”; portable packaging is custom (this repo does that correctly in PowerShell).  
8. Actions **artifacts** are workflow-run storage with configurable retention; they are **not** GitHub Releases. v4 treats uploads as immutable per name within a run.

---

## 2. Inventory — what actually builds

### 2.1 CI (`.github/workflows/ci.yml`)

| Job | When | Produces |
| --- | --- | --- |
| **quality** | Every push (all branches) + PR → `main` | format, lint, tests, cargo test, Vite build; **no** installers |
| **package** | **Only** `main` **push** after quality | Win/Linux installers + collected artifacts |

| Matrix name | Runner | Tauri `--bundles` |
| --- | --- | --- |
| `linux-x64` | `ubuntu-22.04` | `deb,rpm` |
| `windows-x64` | `windows-latest` | `nsis,msi` |

**CI artifact upload** (`actions/upload-artifact@v4`):

| Field | Value |
| --- | --- |
| Name | `AdbGuiNext-${{ matrix.name }}-${{ github.run_number }}` |
| Path | `artifacts/${{ matrix.name }}/` |
| Retention | **14 days** |
| `if-no-files-found` | **error** (fail-closed) |
| Compression | `0` |

Version for collect: **`package.json` version** (not a workflow input).

### 2.2 Publish (`.github/workflows/publish.yml`)

| Job | When | Produces |
| --- | --- | --- |
| **preflight** | Manual `workflow_dispatch` **from `main` only** | Full quality + version verify vs `inputs.version` + Apple-secret detect |
| **build** | After preflight | Same Win/Linux matrix as CI; collect with **`-Release`** |
| **build-macos** | Only if all Apple secrets present | Universal DMG |
| **publish-draft** | After build success; macOS success **or skipped** | Draft GitHub Release + `SHA256SUMS.txt` |

**Publish artifact upload:**

| Field | Value |
| --- | --- |
| Name | `release-${{ matrix.name }}` (or `release-macos-universal`) |
| Retention | **7 days** (intermediate; binaries also attached to draft release) |
| Draft release | `gh release create … --draft --target main` |

**Not used:** `softprops/action-gh-release`. Release is **never auto-undrafted**.

### 2.3 Matrix gaps (by design / by omission)

| Capability | Shipped? | Official path if wanted |
| --- | --- | --- |
| Windows x64 NSIS | Yes | Default Tauri Windows |
| Windows x64 MSI | Yes | WiX on Windows runners only |
| Windows portable zip | Yes (custom script) | Not a Tauri BundleType |
| Linux x64 deb | Yes | Debian guide |
| Linux x64 rpm | Yes | RPM guide |
| Linux AppImage | **No** in CI/publish | BundleType `appimage` exists |
| Windows 32-bit (`i686`) | **No** | `tauri build --target i686-pc-windows-msvc` |
| Windows ARM64 | **No** | `tauri build --target aarch64-pc-windows-msvc` (NSIS; MSI caveats) |
| Linux ARM / armhf | **No** | Debian/RPM ARM cross-compile guides |
| macOS universal DMG | **Optional** (secrets) | Publish only; not CI package |

Release notes v0.2.5 explicitly: **ARM/x86 32-bit not shipped**.

---

## 3. Artifact & installer naming

### 3.1 Collected public names (`scripts/collect-release-assets.ps1`)

| Platform | Final file name pattern |
| --- | --- |
| Windows NSIS | `AdbGuiNext-v{VERSION}-windows-x64-setup.exe` |
| Windows MSI | `AdbGuiNext-v{VERSION}-windows-x64.msi` |
| Windows portable | `AdbGuiNext-v{VERSION}-windows-x64-portable.zip` |
| Linux deb | `AdbGuiNext-v{VERSION}-linux-x64.deb` |
| Linux rpm | `AdbGuiNext-v{VERSION}-linux-x64.rpm` |
| macOS (publish) | `AdbGuiNext-v{VERSION}-macos-universal.dmg` |
| Metadata | `build-info-{windows\|linux\|macos}.json` (excluded from SHA256SUMS) |
| Checksums (publish) | `SHA256SUMS.txt` |

**Naming strengths**

- Stable prefix `AdbGuiNext-`
- Semver after `v`
- Explicit `os` + `arch`
- Installer role suffix (`-setup`, `-portable`)
- Collect requires **exactly one** match per glob (fails if stale multi-file bundle dirs remain)

**Stale-bundle mitigation:** both CI and publish run `rm -rf src-tauri/target/release/bundle` (macOS also universal path) **before** build.

### 3.2 Portable zip internal layout

```text
Adb Gui Next.exe                 ← renamed from target/release/adb-gui-next.exe
resources/windows/...            ← full platform-tools tree (adb, DLLs, etc.)
README-portable.txt              ← WebView2 + “prefer installer” guidance
```

Runtime resolver (`helpers.rs`) checks both:

1. `$RESOURCE/{windows|linux|darwin}/…`
2. `$RESOURCE/resources/{os}/…` ← portable layout

So portable is **compatible** with installed layouts by design.

### 3.3 CI vs release artifact names

| Layer | Pattern | Audience |
| --- | --- | --- |
| GHA CI artifact | `AdbGuiNext-windows-x64-{run_number}` | Developers (14d) |
| GHA publish artifact | `release-windows-x64` | Pipeline only (7d) |
| GitHub Release asset | `AdbGuiNext-v0.2.5-windows-x64-setup.exe` | End users |

This separation is good: run-scoped CI names avoid collisions; release names are versioned.

### 3.4 Official vs custom

| Item | Official Tauri output (typical) | After collect |
| --- | --- | --- |
| NSIS | under `bundle/nsis/*.exe` | Renamed to `…-setup.exe` |
| MSI | under `bundle/msi/*.msi` | Renamed to `…-x64.msi` |
| deb/rpm | under `bundle/deb|rpm/` | Renamed with `AdbGuiNext-v…` |
| Portable | **not produced by Tauri** | Custom zip |

---

## 4. App identity after install (what users see)

### 4.1 Config sources of truth

| Field | Value | File |
| --- | --- | --- |
| `productName` | `AdbGuiNext` | `src-tauri/tauri.conf.json` |
| `identifier` | `com.astrixforge.adbguinext` | same |
| `version` | `0.2.5` | same + Cargo + package.json |
| Window title | `Adb Gui Next` | `tauri.conf.json` → `app.windows[0].title` |
| HTML `<title>` | `ADB GUI Next` | `index.html` |
| Cargo package / default exe stem | `adb-gui-next` | `Cargo.toml` |
| `mainBinaryName` | **unset** | — |
| NSIS/WiX branding overrides | **unset** | — |
| Linux desktop template | **unset** | — |

Per [Tauri config](https://v2.tauri.app/reference/config/):

- **`productName`** drives installer/app branding.
- **`identifier`** is the unique reverse-DNS id (data dirs, bundle identity). Changing it later is a **new app** from OS perspective.
- Without **`mainBinaryName`**, installed binary remains Cargo-derived: **`adb-gui-next.exe`** / `adb-gui-next`.

### 4.2 Identity matrix (expected surfaces)

| Surface | Expected name | Confidence |
| --- | --- | --- |
| Installer product brand | **AdbGuiNext** | High (`productName`) |
| Upgrade / uninstall / app data id | **com.astrixforge.adbguinext** | High (`identifier`) |
| Installed executable filename | **adb-gui-next(.exe)** | High (Cargo name, no override) |
| Window chrome title | **Adb Gui Next** | High (config) |
| Webview document title | **ADB GUI Next** | High (HTML) |
| Portable launcher | **Adb Gui Next.exe** | High (collect rename) |
| GitHub Release title | **Adb Gui Next v{ver}** | High (publish.yml) |
| Start Menu / desktop shortcut label | Typically **productName** (`AdbGuiNext`) under Tauri defaults | Medium (no custom NSIS/WiX strings; not smoke-tested this session) |
| Linux `.desktop` `Name=` | Derived from productName unless `desktopTemplate` set | Medium |

### 4.3 Naming inconsistency (UX, not crash)

Same product appears in **four styles**:

| Style | Examples |
| --- | --- |
| Compact CamelCase | `AdbGuiNext` (productName, artifact prefix) |
| Spaced Title | `Adb Gui Next` (window, portable exe, GH title) |
| ALL CAPS ADB | `ADB GUI Next` (HTML, Cargo description) |
| kebab-case | `adb-gui-next` (binary, npm, crate) |

**Impact:** Users may not match Task Manager `adb-gui-next.exe` to “Adb Gui Next” branding. Not a safety bug; polish issue.

### 4.4 Version consistency gate

`scripts/verify-release-version.mjs` enforces:

1. `package.json` == `Cargo.toml` == `tauri.conf.json`
2. Optional CLI expected version (publish input)
3. Semver-ish regex

**Current state:** all three are **`0.2.5`**. CI quality runs verify without expected; publish runs with `inputs.version`.

**Operational requirement for a new release:** bump all three + add `.github/release-notes/v{version}.md` (only `v0.2.0` and `v0.2.5` exist today). Missing notes file fails `gh release create`.

---

## 5. Windows / Linux configuration review

### 5.1 Platform conf merge (official behavior)

Tauri merges `tauri.{platform}.conf.json` into the base config. Project has:

| File | Content |
| --- | --- |
| `tauri.windows.conf.json` | `bundle.resources: ["resources/windows/**/*"]` only |
| `tauri.linux.conf.json` | `bundle.resources: ["resources/linux/**/*"]` only |
| `tauri.macos.conf.json` | **MISSING** |

Base conf: `bundle.targets: "all"`, icons, macOS DMG layout + `signingIdentity: "-"`, CSP, freezePrototype.

### 5.2 Windows

| Topic | Project state | Official default / note |
| --- | --- | --- |
| Bundles shipped | NSIS + MSI | Supported; MSI requires Windows host (CI uses `windows-latest`) |
| NSIS `installMode` | Not set | Default **current user** (`%LOCALAPPDATA%`) |
| WebView2 | Not set | Default **downloadBootstrapper** |
| Signing | None | Authenticode not configured |
| Portable | Custom zip | Requires WebView2 already present (README in zip) |
| 32-bit / ARM | Not built | Would need explicit `--target` + matching platform-tools |

**Safety:** No custom install path pointing at shared Android SDK folders. Uninstall identity is tied to `identifier` / WiX-NSIS product codes generated by Tauri, not hand-rolled wipe scripts.

**Residual:** No Authenticode → SmartScreen noise on download/run for end users.

### 5.3 Linux

| Topic | Project state | Official note |
| --- | --- | --- |
| Runner | `ubuntu-22.04` | Matches Tauri glibc/WebKitGTK 4.1 guidance |
| Bundles | deb + rpm only | AppImage not in CI |
| deb/rpm depends / scripts | Not customized | Stock Tauri deps (webkitgtk, etc.) |
| Resources | `resources/linux/**/*` | Includes `lib64/libc++.so` for platform-tools |
| chmod in CI package | All major tools | Good |
| chmod in publish | Only `adb` + `fastboot` (+ `|| true`) | **Weaker parity** than CI package |

**Safety:** No custom `pre/postRemove` scripts that could delete arbitrary paths. RPM `obsoletes` not set (good — official docs note obsoletes can auto-remove packages).

### 5.4 macOS (optional path)

| Topic | State | Severity |
| --- | --- | --- |
| Product docs (README / AGENTS) | macOS **out of scope / not planned** | Doc conflict |
| `publish.yml` | Optional universal DMG if secrets | Product conflict |
| v0.2.5 release notes | “macOS support”, lists DMG | Product conflict |
| `resources/darwin/` | Present (platform-tools 37.0.0) | — |
| `tauri.macos.conf.json` | **Absent** → darwin tools **not** declared as `bundle.resources` | **High** if shipping macOS |
| Conf `signingIdentity` | `"-"` (ad-hoc) | Matches notes |

If macOS is shipped without resource conf, app may fall back to **system PATH** adb/fastboot — contradicts “bundled tools” messaging.

---

## 6. Bundled platform-tools & bitness

### 6.1 Inventory

All three OS trees declare **Pkg.Revision=37.0.0**. Flat layout (no arch subdirs).

| OS | Representative files |
| --- | --- |
| windows | `adb.exe`, `fastboot.exe`, `AdbWinApi.dll`, `AdbWinUsbApi.dll`, other tools, `label_reader.jar` |
| linux | `adb`, `fastboot`, `lib64/libc++.so`, tools, jar |
| darwin | same shape as linux + `lib64/libc++.dylib` |

### 6.2 Selection mechanism

- **Not** `build.rs` (only prost + `tauri_build::build()`).
- **Yes** platform conf resource globs + Tauri bundler.
- Runtime: `helpers.rs` resource_dir → portable-style path → dev repo path → `PATH`.

### 6.3 32-bit / 64-bit / portable conclusions

| Question | Answer |
| --- | --- |
| Are CI/release **x64-only** for Win/Linux? | **Yes** (runners + artifact names + no `--target`) |
| Is 32-bit claimed anywhere as shipped? | **No** (release notes say not shipped) |
| Is there arch validation in CI (`file`, PE machine, ELF class)? | **No** |
| Is portable a Tauri target? | **No** — custom Windows zip only |
| Could portable accidentally ship wrong tools? | Collect always copies `resources/windows` from repo — **aligned with x64 Windows app binary from same job** |

**Compatibility risk if someone later adds ARM/32-bit app builds without new resource trees:** wrong-arch adb would fail at runtime. Today matrix prevents that.

---

## 7. Accidental deletion & wrong-behavior safety

### 7.1 Packaging pipeline deletes

| Step | What is deleted | End-user impact |
| --- | --- | --- |
| `rm -rf src-tauri/target/release/bundle` | Build outputs in CI workspace | None |
| Portable staging `Remove-Item … portable` | Temp under `artifacts/...` | None |
| `download-darwin-tools.ps1` temps | Download staging only | None |

**No** workflow step removes:

- `%Program Files%`, `%LOCALAPPDATA%\…` install trees of users  
- `/usr` or system package databases  
- User Android SDK under `%LOCALAPPDATA%\Android\Sdk` (emulator uses that at runtime, not packaging)

### 7.2 Uninstall collision risk

| Factor | Assessment |
| --- | --- |
| Unique `identifier` `com.astrixforge.adbguinext` | Low chance of clobbering unrelated apps |
| Unique productName | Low |
| Custom absolute install path | None configured |
| Portable | User-chosen folder; no uninstaller; cannot wipe another app’s Program Files |

### 7.3 Wrong runtime behavior risks

| Risk | Severity | Notes |
| --- | --- | --- |
| PATH fallback if resources missing | Medium | Uses system adb; version drift |
| macOS without bundled resources | High **if** macOS is product-supported | Missing conf |
| Multi-style names confuse support | Low | UX |
| Unsigned Windows binaries | Medium | SmartScreen |
| Re-run `gh release create` same tag | Medium operational | No overwrite/replace flags documented |
| Local `tauri build` with `targets: "all"` | Low | May produce AppImage etc. not in CI |

### 7.4 Artifact overwrite (GHA)

Per GitHub: v4 artifacts in a single workflow run are not multi-writer “stomped” the way v3 allowed. Project uses **unique names per matrix cell** and `if-no-files-found: error`. Publish downloads `pattern: release-*` with `merge-multiple: true` — safe as long as names stay unique.

Retention: CI 14d / publish artifacts 7d is within GitHub’s configurable retention model.

---

## 8. Docs vs code matrix

| Claim | Source | Reality |
| --- | --- | --- |
| Win MSI + NSIS install | README | Matches CI/publish |
| Linux deb + rpm | README | Matches |
| Win portable zip | README platform table | Matches collect script |
| macOS not planned | README / AGENTS | **Conflicts** with publish + v0.2.5 notes + conf macOS section |
| macOS newly supported | v0.2.5 notes | Optional pipeline; **resource conf gap** |
| Version 0.2.5 | configs | Verified consistent |
| Package every branch | Old 2026-05-14 audit | **Superseded** — package is main-only (2026-07-17 remediation) |

### Prior packaging audits still open

| Item | Status after this audit |
| --- | --- |
| Main-only package + quality split | **Done** (live workflows) |
| Optional macOS (don’t hard-fail secrets) | **Done** |
| Bun cache / timeouts / full publish preflight | **Done** |
| `tauri.macos.conf.json` | **Still open** |
| Windows Authenticode | **Still open** |
| Path-filter efficiency (docs-only main pushes still package) | **Still open** (efficiency, not correctness) |
| README macOS line | **Still open** |

---

## 9. Severity-ranked findings

| ID | Sev | Finding | Recommendation |
| --- | --- | --- | --- |
| P1 | **High** | macOS product messaging conflict (README/AGENTS vs publish + release notes) | **Pick one:** either first-class macOS (docs + conf + resources) or remove/disable macOS publish path and rewrite notes |
| P2 | **High** (if macOS ships) | No `tauri.macos.conf.json` with `resources/darwin/**/*` | Add platform conf mirroring Win/Linux; verify tools inside DMG |
| P3 | **Medium** | No Windows code signing | Document SmartScreen; plan Authenticode / future signing secrets |
| P4 | **Medium** | Four display-name styles + exe `adb-gui-next` | Standardize: set `mainBinaryName` and/or unify titles to one marketing string |
| P5 | **Medium** | Publish Linux chmod only adb/fastboot | Match CI package full chmod list |
| P6 | **Low** | `bundle.targets: "all"` vs CI `--bundles` | Document “CI is source of truth”; optional set conf targets to match |
| P7 | **Low** | No AppImage / no 32-bit / no ARM Win-Linux | Keep explicit non-goals in README + release notes (already partly done) |
| P8 | **Low** | No arch integrity check on platform-tools | Optional CI step: verify PE/ELF arch matches job |
| P9 | **Info** | NSIS defaults (per-user install, download WebView2) | Accept or set `installMode` / embed bootstrapper intentionally |
| P10 | **Info** | Draft-only release is good safety | Keep; undraft is human gate |
| P11 | **Info** | Re-publish same version may fail | Document “bump version” or use `gh release delete/edit` policy |
| P12 | **Info** | Portable is custom, not Tauri BundleType | Keep script; do not claim official Tauri portable target |

---

## 10. What is working well (keep)

1. **Version triple gate** (`package.json` / `Cargo.toml` / `tauri.conf.json`).  
2. **Quality always; package main-only** — reduces branch artifact noise and cost.  
3. **Ubuntu 22.04** Linux builds — aligns with Tauri glibc guidance.  
4. **Explicit `--bundles`** — predictable ship set (nsis/msi, deb/rpm).  
5. **Collect rename convention** — clear, versioned, arch-tagged public assets.  
6. **Portable dual-path resolver** — install + zip both work.  
7. **Fail-closed uploads** (`if-no-files-found: error`) + exact-one artifact globs.  
8. **Draft release + SHA256SUMS** — human gate before public.  
9. **Cleanup scoped to build trees** — no install-path wipes.  
10. **Unique reverse-DNS identifier** — correct upgrade/uninstall boundary.

---

## 11. Recommended decision tree (product)

```text
Is macOS first-class for v0.x?
├─ YES → add tauri.macos.conf.json resources
│        update README/AGENTS
│        keep optional signing secrets path
│        smoke-test DMG has darwin tools
└─ NO  → remove or permanently disable build-macos
         fix v0.2.5 notes / future notes
         keep resources/darwin only as optional prep or drop from claims
```

Windows/Linux x64 path can stay as-is for shipping correctness.

---

## 12. Suggested verification checklist (manual / CI)

Not executed in this audit session (no `tauri build` run here). For next release:

| # | Check |
| --- | --- |
| 1 | `bun run release:verify` and `bun scripts/verify-release-version.mjs 0.2.5` |
| 2 | After main package job: download CI artifacts; confirm 3 Win files + 2 Linux + build-info |
| 3 | Install NSIS → Start Menu name, exe name, uninstall entry id, adb from resource_dir |
| 4 | Install MSI side-by-side/upgrade behavior vs NSIS (same identifier) |
| 5 | Extract portable zip → run without install; confirm tools under `resources/windows` |
| 6 | Linux: `dpkg -c` / `rpm -qlp` list includes resources; desktop Name field |
| 7 | If macOS enabled: confirm `resources/darwin` inside app bundle; no PATH-only adb |
| 8 | SHA256SUMS matches downloaded release assets |

---

## 13. Evidence index

### Repo

| Path | Role |
| --- | --- |
| `.github/workflows/ci.yml` | Quality + main-only package matrix |
| `.github/workflows/publish.yml` | Manual draft release pipeline |
| `scripts/collect-release-assets.ps1` | Rename + portable zip |
| ~~`scripts/verify-release-version.mjs`~~ | **Removed** — official `tauri.conf.json` `"version": "../package.json"` |
| `src-tauri/tauri.conf.json` | productName, identifier, targets |
| `src-tauri/tauri.windows.conf.json` / `tauri.linux.conf.json` | Resource globs |
| `src-tauri/Cargo.toml` | Binary stem `adb-gui-next` |
| `src-tauri/src/helpers.rs` | Resource resolution |
| `src-tauri/resources/{windows,linux,darwin}/` | Platform-tools 37.0.0 |
| `.github/release-notes/v0.2.5.md` | Public asset list + arch policy |
| `README.md` platform table | User-facing claims |
| Prior: `docs/internal/reports/closed/2026-07-17/2026-07-17-github-actions-packaging-audit.md` | Remediation baseline |

### Official

- https://v2.tauri.app/reference/config/
- https://v2.tauri.app/distribute/windows-installer/
- https://v2.tauri.app/distribute/debian/
- https://v2.tauri.app/distribute/rpm/
- https://docs.github.com/en/actions/tutorials/store-and-share-data
- https://github.blog/news-insights/product-news/get-started-with-v4-of-github-actions-artifacts/

### Subagents (this audit)

1. CI/release workflows + collect/version scripts  
2. Tauri identity/config matrix  
3. Resources, prior reports, safety of cleanup paths  

---

## 14. Bottom line

| Area | Grade | One-liner |
| --- | --- | --- |
| CI package gating | **A** | Quality everywhere; installers only on main push |
| Release safety | **A-** | Draft + checksums + version gate; re-tag policy undocumented |
| Artifact naming | **A** | Clear `AdbGuiNext-v{ver}-{os}-{arch}-…` scheme |
| Win/Linux x64 packaging | **A-** | Correct bundles; missing optional NSIS polish/signing |
| Portable Windows | **A-** | Custom but coherent with resolver + WebView2 docs |
| Post-install naming | **B** | Unique id good; display/exe strings inconsistent |
| 32-bit / multi-arch | **N/A by design** | Correctly out of ship set; document forever |
| macOS | **C / incomplete** | Optional pipeline + notes vs docs; missing resource conf |
| Accidental deletion | **A** | Build/staging only; no user-path wipes |

**Ship confidence for Windows/Linux x64 installers + portable zip:** high, given current configs and gates.  
**Ship confidence for macOS as “bundled tools first-class”:** low until `tauri.macos.conf.json` + docs alignment.

---

---

## 15. Follow-up (2026-07-18) — full build matrix + portable RCA + applied changes

### 15.1 Portable “Unsupported 16-Bit Application” (user repro)

**Symptom (screenshot):** Windows dialog:

> Unsupported 16-Bit Application  
> …`AdbGuiNext-…-portable\resources\windows\adb.exe` cannot start or run due to incompatibility with 64-bit versions of Windows.

**What we measured in-repo (not memory):**

| File | PE machine | Notes |
| --- | --- | --- |
| `src-tauri/resources/windows/adb.exe` | **`x86` (i386, 0x014c)** | Valid PE (~8.4 MB); `adb version` runs on host x64 Windows |
| Other `resources/windows/*.exe` / DLLs | **x86** | Google platform-tools style |
| Built app `adb-gui-next.exe` (debug) | **x64** | Tauri/Rust default host |

**Conclusion:** `adb.exe` is **not** 16-bit. It is a **normal 32-bit (x86) PE**. On 64-bit Windows it is supposed to run under **WOW64**. Microsoft’s “16-Bit Application” dialog is often shown when:

1. **Corrupt / incomplete file** (common with **OneDrive Files On-Demand** on Desktop paths — user path was under `OneDrive\Desktop\…`), or  
2. Truncated/non-PE content that still has a broken MZ header, or  
3. User double-clicked a cloud placeholder stub.

**Not the root cause:** “app is 64-bit so adb must be 64-bit” — Google’s Windows platform-tools have long shipped **x86** adb; that is OK on x64 Windows.

**Mitigations applied:**

- `collect-release-assets.ps1` **PE validation** (MZ + PE signature + machine) for app + `adb.exe` before zip.  
- Portable **README** warns: extract to **local** folder (not OneDrive-only); run **Adb Gui Next.exe**; documents tool PE arch.  
- User workaround: re-download zip → extract to `C:\Tools\…` (non-OneDrive) → run main exe.

### 15.2 Official standards (macOS skipped)

| Layer | Official options (Tauri 2) |
| --- | --- |
| Windows bundles | `nsis`, `msi` ([Windows installer](https://v2.tauri.app/distribute/windows-installer/)) |
| Linux bundles | `deb`, `rpm`, `appimage` ([Debian](https://v2.tauri.app/distribute/debian/), [RPM](https://v2.tauri.app/distribute/rpm/), [AppImage](https://v2.tauri.app/distribute/appimage/)) |
| Windows arches | host x64; `--target i686-pc-windows-msvc`; `--target aarch64-pc-windows-msvc` |
| Linux arches | host x64; ARM via ARM runners / cross ([docs](https://v2.tauri.app/distribute/debian/)) |
| Portable | **Not** a BundleType — project custom zip |
| Universal | **macOS** concept — not used for Win/Linux |

### 15.3 Target ship matrix (product, mac paused)

| # | OS | Arch | Formats | Status after apply |
| --- | --- | --- | --- | --- |
| 1 | Windows | **x64** | NSIS + MSI + portable | **Enabled** |
| 2 | Windows | **x86** | NSIS + MSI + portable | **Enabled** (tools already x86) |
| 3 | Windows | **ARM64** | NSIS + portable | **Enabled** (tools remain x86; needs OS x86 emulation) |
| 4 | Linux | **x64** | deb + rpm + **AppImage** | **Enabled** (AppImage added) |
| 5 | Linux | ARM64 | deb/rpm/AppImage | **Blocked** — `resources/linux/adb` is **ELF x86_64** only |
| 6 | Linux | armhf 32 | — | **Out** (rare) |
| 7 | macOS | universal | DMG | **Paused** (project policy) |

### 15.4 Code / CI changes applied

| Change | Path |
| --- | --- |
| Multi-arch collect (`-Arch`, `-TargetTriple`), AppImage copy, PE checks, portable README | `scripts/collect-release-assets.ps1` |
| CI matrix: linux-x64 (deb,rpm,appimage), windows-x64, windows-x86, windows-arm64 | `.github/workflows/ci.yml` |
| Publish matrix: same | `.github/workflows/publish.yml` |
| Platform policy table | `docs/project_rules.md` |
| README platform table | `README.md` |
| Identifier (earlier) | `com.astrixforge.adbguinext` in `tauri.conf.json` |

### 15.5 Remediation pass (same day, no signing)

| Item | Status |
| --- | --- |
| Display-name unify → **ADB GUI Next** | **Done** (`productName`, window title, artifacts `ADB-GUI-Next-…`, portable exe) |
| Identifier | **Done** `com.astrixforge.adbguinext` |
| Windows full conf (WebView2 embed bootstrapper, NSIS currentUser, allowDowngrades false, publisher, license, descriptions) | **Done** |
| Bundle targets explicit (not `"all"`) | **Done** `nsis,msi,deb,rpm,appimage` |
| `tauri.macos.conf.json` resources | **Done** (builds still **paused**) |
| AppImage + multi-arch CI matrix | **Done** (linux-arm blocked by tools) |
| Publish Linux chmod parity | **Done** |
| Re-publish guard (existing tag fails) | **Done** |
| PE checks on portable | **Done** (`make-windows-portable.ps1`) |
| Code signing | **Skipped by product decision** |
| Linux ARM64 packages | **Open** — need aarch64 platform-tools |
| macOS unpause | **Open** — product policy |

### 15.7 Option A applied — official `tauri-action`

| Before | After |
| --- | --- |
| `bun run tauri build` + `collect-release-assets.ps1` rename | **`tauri-apps/tauri-action@v1`** build + naming patterns |
| One custom script for all platforms | **Installers = official action**; **portable only** = `scripts/make-windows-portable.ps1` |
| Manual `gh release create` of copied files | Action uploads installers to **draft** `v{version}`; finalize adds notes + `SHA256SUMS` |

Refs: https://v2.tauri.app/distribute/pipelines/github/ · https://github.com/tauri-apps/tauri-action

### 15.6 Expected release asset names (examples v0.2.5)

```text
AdbGuiNext-v0.2.5-windows-x64-setup.exe
AdbGuiNext-v0.2.5-windows-x64.msi
AdbGuiNext-v0.2.5-windows-x64-portable.zip
AdbGuiNext-v0.2.5-windows-x86-setup.exe
AdbGuiNext-v0.2.5-windows-x86.msi
AdbGuiNext-v0.2.5-windows-x86-portable.zip
AdbGuiNext-v0.2.5-windows-arm64-setup.exe
AdbGuiNext-v0.2.5-windows-arm64-portable.zip
AdbGuiNext-v0.2.5-linux-x64.deb
AdbGuiNext-v0.2.5-linux-x64.rpm
AdbGuiNext-v0.2.5-linux-x64.AppImage
SHA256SUMS.txt
```

---

*Original investigation was read-only; §15 documents applied follow-up work and portable RCA.*
