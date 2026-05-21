# Active Context

## Current State

ADB GUI Next is a fully functional Tauri 2 desktop application on `release/v0.2.0` branch (version bumped from 0.1.0 → 0.2.0).
All responsive layout fixes, sticky header, adaptive hardening, and the April 2026 shadcn frontend audit implementation are complete.
**Flasher Spacing Layout and Drop Zone Centering is complete (2026-05-21):** Both Flasher view cards use symmetrical vertical flex boxes (`flex flex-1 flex-col`). Sideload drop zone area sits in the exact vertical center of the card via top and bottom `flex-grow` spacers, and has protective min-height gaps to prevent visual squishing relative to the recovery helper text.
**Emulator Root Tabbed Setup & Simplified Wizard is complete (2026-05-22):** The root wizard step timeline is reorganized into a clean 4-stage flow (Preflight ➔ Setup ➔ Patching ➔ Verify). The Preflight stage has been made manual, requiring the user to explicitly click "Start Preflight Scan" (which displays checks without auto-proceeding once green) and then click "Continue to Setup →" to progress. Within the Setup stage, a horizontal secondary tab layout embeds Autopilot (Automated Magisk Patch) and Manual Fallback (FAKEBOOTIMG) side-by-side. Transition between modes is handled seamlessly (e.g. failing Autopilot guides the user directly to the active Manual tab). Both modes route through a unified, premium Verification & Result screen. In the Manual mode layout, the "Create fakeboot.img" action button is stacked vertically, full-width, directly below the "Choose Magisk Package" card to ensure high visual consistency and match the premium design guidelines.
ThemeToggle now cycles themes (Light → Dark → System) on single click with correct icon display and tooltip. Debloater has been optimized with Rust-side in-memory caching to prevent redundant data reloads on every navigation. `GetDebloatData()` returns packages, settings, backups, and list status in a single call, eliminating 3 redundant network round-trips.
Marketplace Phase 1 architecture refactor is complete: singleton HTTP client (connection pooling), APK verification engine (JoinSet + Semaphore), heuristic scoring engine (8 weighted signals), bounded cache (capacity limits), language extraction from GitHub API, F-Droid installable fix, and dynamic trending date.
Emulator Manager is implemented and **fully working** on Windows. Root pipeline has been **fully modernized** (3-phase overhaul). **Universal Android Debloater (UAD) Integration is now complete** with Rust-side caching.
**Payload Dumper interaction polish is complete (2026-05-11).**
**File Explorer layout hardening is complete (2026-05-14): table columns are grid-aligned and delete confirmation filenames wrap safely.**
**Frontend feature architecture migration is complete (2026-05-14): app shell is under `src/app`, Tauri IPC under `src/desktop`, shared code under `src/shared`, and product code under `src/features/<feature>`. Legacy `src/components` and `src/lib` folders are removed.**
**Dashboard Wireless ADB card is now collapsible (2026-05-15): collapsed by default with chevron toggle, saving vertical space for users who don't use wireless ADB.**
**File Explorer toolbar overlap fix is complete (2026-05-15): replaced viewport-based height calc with flex layout propagation through MainLayout wrapper chain.**
**File Explorer scroll containment fix is complete (2026-05-15): file list owns its scroll region, table header remains sticky, and toolbar actions are horizontally contained on narrow widths.**
**File Explorer tree scroll fix is complete (2026-05-15): expanded tree nodes no longer use a fixed 500px height cap, so large directories scroll through the side panel instead of clipping lower root entries.**
**File Explorer tree resize handle is improved (2026-05-15): the side panel splitter now has a wider pointer hit target, keyboard arrow support, and more useful default/min/max widths.**
**File Explorer root access is implemented (2026-05-15): manual verified shield grant, stable normal explorer state, root tree shortcut, root-aware IPC mode, and staged root import/export.**
**Dashboard Wireless ADB UI persistence is complete (2026-05-16): collapsible open/closed state, IP address, and port field now persist across sessions via Zustand store with localStorage.**
**File Explorer toolbar consolidation is complete (2026-05-16): New File, New Folder, and Export standalone buttons removed; all actions now live in the always-visible 3-dot More Actions menu. Import button replaced with unified Transfer dropdown containing Import File, Import Folder, and Export.**
**File Explorer tree panel width persistence is complete (2026-05-16): user-resized tree width is saved to localStorage and restored on reload, defaulting to 280px on first use.**
**react-doctor audit + fixes complete (2026-05-16):** Score 69→81/100. 137 issues fixed across 67+ files. 140 remain (mostly false positives). See REACT_DOCTOR_AUDIT_REPORT.md.

---

## Recently Completed

### 2026-05-22 - Emulator Root Tabbed Setup & Simplified Wizard

**Change:** Restructured the Emulator Root tab to simplify the step-by-step wizard into a 4-stage pipeline (Preflight, Setup, Patching, Verify). Made preflight scan manual (replacing automated trigger and auto-proceed with explicit clicks and start button) and improved the Manual Fallback layout by vertically stacking the "Create fakeboot.img" button beneath the package picker card.

**Fixed:**
- Reorganized the step timeline to map to a simplified, abstract 4-stage flow.
- Replaced the Source and Manual separate wizard steps with a unified Setup step using a horizontal tabs component.
- Removed `useEffect`-based automatic scan on wizard load, introducing a manual "Start Preflight Scan" action button.
- Prevented automatic wizard redirection to Setup step after a green preflight check, requiring an explicit user click on "Continue to Setup →".
- Vertically stacked the "Choose Magisk Package" card and "Create fakeboot.img" action button full-width in the Manual fallback tab to match project UI consistency guidelines.
- Implemented state redirection (`setSetupTab`) so that a failure in Autopilot's rooting step allows a smooth redirect directly to the active Manual Fallback tab.
- Integrated manual finalization success (`FINALIZE_SUCCESS`) with the global store's `setRootWizardResult()` to feed into the unified premium Result and Verification screen.
- Cleaned up manual mode props and redundant controls (`onBack`/`onColdBoot`).
- Updated all associated React unit tests to use tab trigger role searches, manual preflight click sequences, and updated text labels.
- Resolved Biome class sorting (`useSortedClasses`) and unused imports (`waitFor`) across refactored files.

**Verification:** format ✅ · lint ✅ · build ✅ · test 174/174 pass


### 2026-05-21 - Flasher Spacing Layout and Drop Zone Centering

**Change:** Hardened the Flasher View layout for both cards (Flash Partition and Recovery Sideload) to use symmetrical, full-height vertical flex layouts (`flex flex-1 flex-col`). Balanced the vertical space inside the Recovery Sideload card by placing matching `flex-grow` spacers above and below the DropArea/FileSelector block.

**Fixed:**
- Center-aligned the Recovery Sideload DropArea vertically within the card's available body space (resolving the massive bottom-heavy gap).
- Added a protective `min-h-4` bottom spacer above the recovery helper text to prevent visual squishing and establish consistent spacing.
- Unified the visual hierarchy of both Flasher cards under a robust responsive grid layout.

**Verification:** format ✅ · lint ✅ · build ✅ · test 174/174 pass

### 2026-05-16 - react-doctor Audit & Fixes

**Change:** Ran `react-doctor v0.1.6` (score 69/100, 277 issues). Used parallel subagents. Score: 81/100. Session interruption caused first-round fixes to be lost; all re-applied.

**Fixed:**
- 75 Tailwind `h-N w-N` → `size-N` (20 files)
- Dead code: 11 backend.ts exports, 4 debug.ts, 2 queries.ts, 1 duplicate export, knip.json
- Performance: Intl hoisting, bounce removal, passive listeners, DOM CSS batching, iteration combining, default prop, scale:0
- A11y: DirectoryTree span→button, input-group keyboard, button labels
- Design: ellipsis, em dash, bold→semibold, padding
- React 19: `useContext` → `use()` (2 files)
- State: useReducer in FileExplorerView (27→0 useState), InstallationTab, EmulatorLaunchTab, RootManualStep
- Architecture: BottomPanel split (578→193 lines), MainLayout split (322→199 lines), FileExplorerMainPane booleans grouped
- ES2023: tsconfig + toSorted()
- useSyncExternalStore for viewport height

**Reverted (caused regression):** LazyMotion migration, isVisible→useRef, event handler ref stabilization

**Remaining 140 issues:** 68 shadcn exports, 12 Zustand batching, 8 test iterations, 6 autoFocus, 6 index-as-key, 5 false types, 4 lazy-motion (DO NOT FIX), 3 event-handler-refs (DO NOT FIX), 3 giant components, 2 async-in-loop, 2 hydration, 2 toSorted, 2 effect-handler

**Verification:** format ✅ · lint ✅ · build ✅ · test 172/174 pass (2 pre-existing)

### 2026-05-16 - File Explorer Tree Panel Width Persistence

**Change:** Tree panel width now persists across sessions. `leftWidth` state initializes from `localStorage` key `fe.treeWidth` if a valid value exists (within `MIN_LEFT_WIDTH`/`MAX_LEFT_WIDTH` bounds), falling back to `DEFAULT_LEFT_WIDTH` (280px). A `useEffect` syncs every width change (drag or keyboard resize) back to localStorage.

**Verification:** `bun run build` ✅ · `bun run lint:web` ✅ · `bun run format:check` ✅.

### 2026-05-16 - File Explorer Toolbar Consolidation + Transfer Button

**Change:** Replaced the responsive import/export button split with a unified **Transfer** dropdown menu. Standalone New File, New Folder, and Export buttons removed from the toolbar. The 3-dot More Actions menu is now always visible (removed `xl:hidden`). The old `FileExplorerImportButton` was replaced with `FileExplorerTransferButton` — a single icon button (`ArrowUpToLine`) with a dropdown containing Import File, Import Folder, and Export options.

**Verification:** `bun run build` ✅ · `bun run lint:web` ✅ · `bun run format:check` ✅.

### 2026-05-16 - Dashboard Wireless ADB UI Persistence

**Change:** Wireless ADB card UI state now persists across sessions. Created `useWirelessAdbStore` (Zustand + `persist` middleware) storing collapsible open/closed state, IP address, and port. `DashboardView` initializes the `useForm` defaults from persisted values and syncs form changes back via `useWatch` + `useEffect`. `WirelessAdbCard` receives collapsible state as props instead of managing local `useState`.

**Verification:** `bun run build` ✅ · `bun run lint:web` ✅ · `bun run format:check` ✅.

### 2026-05-15 - File Explorer Tree Resize Handle

**Change:** Replaced the one-pixel tree splitter hit target with a dedicated `FileExplorerTreeResizeHandle` component. The visual divider remains one pixel, but the interactive target is 12px wide and uses pointer events for mouse/touch/stylus resizing.

**UX:** Tree panel width defaults to 280px with a 220px minimum and 520px maximum. The splitter exposes `role="separator"` with ARIA width values and supports `ArrowLeft`/`ArrowRight` keyboard resizing in 16px steps.

**Architecture:** Extracted `FileExplorerTreeSection` so `FileExplorerView.tsx` stays under the 300-line architecture guard.

**Verification:** `bun vitest run src/test/ViewFileExplorer.test.tsx src/test/frontendArchitecture.test.ts` ✅ · `bun run lint:web` ✅ · `bun run format:check` ✅ · `bun run test` ✅ · `bun run build` ✅.

### 2026-05-15 - File Explorer Tree Scroll Fix

**Change:** Removed the artificial `max-h-[500px] overflow-hidden` wrapper from expanded `DirectoryTree` children. Large directories such as `/sdcard/Android/data` now render their full child list and let the side panel's shadcn `ScrollArea` own vertical scrolling.

**Layout:** Added `min-h-0` through `FileExplorerTreePane` and `DirectoryTree` so the tree scroll viewport receives a bounded height. Tree rows now keep a `min-w-0` truncation chain for deeply nested package names, and the collapse icon button has an explicit accessible label.

**Verification:** Added a regression test that expands a 60-entry directory and asserts the last entry renders without the old 500px cap. `bun vitest run src/test/DirectoryTree.test.tsx src/test/ViewFileExplorer.test.tsx` ✅ · `bun run lint:web` ✅ · `bun run format:check` ✅ · `bun run test` ✅ · `bun run build` ✅.

### 2026-05-15 - File Explorer Scroll Containment

**Change:** Fixed File Explorer long-directory scrolling and toolbar responsiveness. The file list now uses a direct bounded `overflow-auto` scroll container with `min-h-0`, and TanStack Virtual receives that exact `HTMLDivElement` instead of inferring a parent through shadcn `ScrollArea`.

**UI:** The toolbar remains a fixed `shrink-0` row above the list. The action group is horizontally contained with its own overflow behavior on narrow widths, so it no longer pushes the path area or page layout wider than the viewport.

**Verification:** Added a DOM regression test proving the file list owns the scroll region and the toolbar action group is overflow-contained. `bun run lint:web` ✅ · `bun run format:check` ✅ · `bun run test` ✅ · `bun run build` ✅.

### 2026-05-15 - File Explorer Root Access

**Change:** Added manual root access for File Explorer. The toolbar uses a shield toggle, verifies `su -c id -u == 0` before granting access, remembers the grant globally, and falls back to normal access if persisted verification fails.

**Backend:** File commands now accept `FileAccessMode` (`normal`/`root`). Normal mode keeps safe write path validation. Root mode keeps traversal/null/empty path validation but bypasses safe-prefix restrictions, runs shell mutations through `su -c`, and stages root import/export under `/data/local/tmp/adb-gui-next-root-transfer/`.

**Frontend:** File Explorer no longer has a global root mode. It stores `rootAccessGranted` and derives `FileAccessMode` per target path, so normal storage paths stay normal while `/`, `/data`, `/system`, and other root-owned paths use root after verification. `DirectoryTree` keeps `sdcard` and `storage`, replaces the old `data` shortcut with `root`, and loads `/` through the same path-aware resolver. The active shield uses destructive red styling.

**Verification:** `bun run format:check` ✅ · `bun run lint:web` ✅ · `bun run lint:rust` ✅ · `bun run test` ✅ · `bun run build` ✅ · Rust file tests compile with `cargo test --no-run`; execution is blocked by the known Windows Tauri loader error `STATUS_ENTRYPOINT_NOT_FOUND`.

### 2026-05-15 - File Explorer Toolbar Overlap Fix

**Change:** Fixed the File Explorer toolbar overlapping with the main header. The root cause was `h-[calc(100svh-4rem)]` — a viewport-based height that assumed a 4rem header. The actual header is `h-12` (3rem), and the parent wrapper adds `p-4 sm:p-6` padding that wasn't accounted for.

**Fix:** Replaced the viewport calc with flex layout propagation. Added `flex flex-col` + `flex-1 min-h-0` to the wrapper chain in MainLayout (padding div, content div, motion.div) so height propagates from the scroll area down to views. FileExplorerView now uses `flex min-h-0 flex-1` instead of the viewport calc. Other views are unaffected — they don't use `flex-1` on their roots.

**Verification:** `bun run build` ✅ · biome check ✅

### 2026-05-15 - Dashboard Wireless ADB Card Collapsible

**Change:** Wrapped the Wireless ADB Connection card in a shadcn `Collapsible` primitive (Radix) so it's collapsed by default. Users click the header to expand Step 1 (USB enable) and Step 2 (WiFi connect). A `ChevronDown` icon rotates 180deg on open via CSS transition. The card header remains visible at all times so the feature is discoverable.

**Verification:** biome check ✅ · `bun run build` ✅ · committed as `289d5c7`

### 2026-05-14 - Frontend Feature Architecture Migration

**Change:** Migrated the frontend to a strict feature-first layout: `src/app` owns the app shell, `src/desktop` owns the Tauri boundary, `src/shared` owns cross-feature primitives/components/stores/utils, and `src/features/<feature>` owns product feature code.

**File Explorer:** Split the large view into feature-local hooks, model/constants/types, utilities, and focused UI modules. `FileExplorerView.tsx` is now under the architecture size gate, and `frontendArchitecture.test.ts` enforces no legacy frontend folders/imports, raw Tauri invoke confinement, and no feature implementation file over 300 lines.

**Verification:** Full gate is complete in-session: `bun run format:check`, `bun run lint:web`, `bun run lint:rust`, `bun run test` (26 files / 167 tests), `bun run build`, architecture boundary test, legacy import scan, and feature size scan all pass.

### 2026-05-14 - File Explorer Table Alignment + Delete Dialog Wrapping

**Change:** Fixed File Explorer row/header column drift by giving the file table a single explicit grid column model shared by the header, phantom create row, empty-search row, and virtualized file rows. Name and symlink text now wrap inside the name column while size/date/time remain fixed and aligned.

**Also fixed:** Long filenames in the delete confirmation dialog now wrap instead of overflowing the modal. Multi-delete filename previews use the same min-width and break-word treatment.

**Tests:** Added `src/test/ViewFileExplorer.test.tsx`, covering the long-filename delete dialog wrap regression.

**Verification:** `bun vitest run src/test/ViewFileExplorer.test.tsx` ✅ · `bun run format:web` ✅ · full verification pending in current session.

### 2026-05-12 - Debloater Rust-Side In-Memory Cache + ThemeToggle Fix

**Change:** Debloater data (packages, settings, backups, list status) is now cached in Rust memory (`DebloatCache` with `Mutex<DebloatCacheInner>`) and served from cache on subsequent navigations back to the Debloater tab. A new `get_debloat_data` command returns all 4 data items in one call. Cache is invalidated when `debloat_packages`, `restore_debloat_backup`, or `refresh_debloat_data` is called.

**Also fixed:**
- ThemeToggle now cycles Light → Dark → System on single click (was: system theme only)
- ThemeToggle uses `theme` (not `resolvedTheme`) for icon/tooltip display
- Debloater Select All / Unselect All icons were swapped — fixed: Square = empty/select, CheckSquare2 = checked/unselect
- `packageManager` field in `package.json` updated from `bun@latest` to exact `bun@1.3.13`
- `package.json` field ordering standardized: name, type, version, private, packageManager, scripts, dependencies, devDependencies

**New Rust files:** `src-tauri/src/debloat/cache.rs` — `DebloatCache` struct with `get_packages`, `set_packages`, `get_settings`, `set_settings`, `get_backups`, `set_backups`, `invalidate`, `clear`.

**New Tauri commands:** `get_debloat_data`, `refresh_debloat_data` — both added to `src-tauri/permissions/autogenerated.toml`.

**Frontend changes:**
- `DebloaterTab.tsx` — now calls single `GetDebloatData()` instead of 4 separate calls (`GetDebloatPackages`, `GetDebloatDeviceSettings`, `ListDebloatBackups`, `LoadDebloatLists`)
- `backend.ts` — `DebloatData` interface, `GetDebloatData()` and `RefreshDebloatData()` wrappers
- `ThemeToggle.tsx` — `cycleTheme()` callback, `getIcon()`, `getTooltipText()` with `mounted` guard for SSR
- `DebloaterTab.tsx` — Select All uses `Square`, Unselect All uses `CheckSquare2`

**Verification:** `bun run lint:web` ✅ · `bun run build` ✅

### 2026-05-11 - Payload Dumper Layout Polish + Global Toast Position

**Change:** Tightened the loaded Payload Dumper UI without changing backend extraction behavior. The payload banner keeps its original compact card treatment but now adds a wrapped `Source` line directly below the payload filename for both local imports and remote URLs. The partition search input now lives immediately above the table header, centered within the table container instead of reading like a separate banner control. The footer actions were reshaped into a wide bottom row so `Reset` and `Extract`/`Cancel` match the table width and read as primary page actions.

**Additional UI cleanup:** `PartitionRow` now wraps long names and renders the extracted filename form (`.img`) directly in the list. `ExtractionStatusCard` was condensed into an inline summary style with compact output-path and file chips. The redundant sidebar theme toggle was removed, leaving the header toolbar as the sole theme entry point. The global Sonner toaster moved from bottom-right to top-right.

**Files changed:** `src/components/AppSidebar.tsx`, `src/components/MainLayout.tsx`, `src/components/payload-dumper/ActionFooter.tsx`, `src/components/payload-dumper/ExtractionStatusCard.tsx`, `src/components/payload-dumper/FileBanner.tsx`, `src/components/payload-dumper/PartitionRow.tsx`, `src/components/payload-dumper/PartitionTable.tsx`

**Verification:** `bun run lint:web` ✅ · `bun run build` ✅

### 2026-04-28 - Emulator Root Verification Fix

**Change:** Split emulator root completion into two explicit states: patch installation and verified root. The automated `root_avd` pipeline now returns `activationStatus: patchInstalled` with a message telling the user to cold boot and verify. A new `verify_avd_root` command checks ADB online state, `sys.boot_completed`, installed Magisk-family package presence, and `su -c id -u`; the UI only renders **Root Verified** after that command returns uid `0`.

**Backend hardening:** `adb_shell_checked()` now fails if the shell exit marker is missing, preventing aborted critical commands from being treated as success. Magisk Manager install is attempted before sending `setprop sys.powerctl shutdown`. The automated patch path logs detected multi-CPIO ramdisks but continues to the real `magiskboot` validation steps instead of falsely blocking API 30+ AVDs.

**Verification:** Focused frontend tests and `cargo check` passed. Full gate results are recorded in the current session final notes.

### 2026-04-28 - FAKEBOOTIMG Manual UI + Offline Boot Polling Fix

**Change:** Added a first-class **Manual Mode (FAKEBOOTIMG)** wizard step that uses the existing `prepare_avd_root` and `finalize_avd_root` backend commands. Users can now enter manual mode from the Source step or after an automated root failure, choose any local Magisk `.apk`/`.zip`, create `/sdcard/Download/fakeboot.img`, patch it inside Magisk, then finalize the patched ramdisk from the UI.

**Runtime hardening:** `wait_for_boot_completed()` now checks `runtime::is_serial_online()` before calling `getprop sys.boot_completed`, so boot polling no longer floods logs with repeated `adb shell ... device offline` warnings while the emulator is still transitioning to ADB online. The automated root boot wait was extended from 60s to 180s for slower cold boots.

**Verification:** Added focused tests for the manual FAKEBOOTIMG flow and offline boot polling guard. `bun run test`, `bun run format:check`, `bun run lint:web`, isolated-target `bun run lint:rust`, and `bun run build` passed. `cargo test` compiled but still exits with the known Windows Tauri-linked `STATUS_ENTRYPOINT_NOT_FOUND` test harness failure.

### 2026-04-28 - Emulator Root Multi-CPIO + Magisk Version Fix

**Change:** Fixed the API 30+ Play Store/x86_64 root failure by matching rootAVD's multi-CPIO ramdisk flow. After decompression, `patch_ramdisk_in_emulator()` now detects multiple `TRAILER!!!` markers, extracts split CPIO archives with bundled busybox, rebuilds a single `newc` CPIO, and only then runs `magiskboot cpio ... test` and patching. The automated Magisk source now uses the rootAVD-compatible `v25.2` package, preferring the local `docs/refrences/github-repos/rootAVD/Magisk.zip` clone before falling back to the upstream v25.2 APK URL.

**Live verification:** The local `Medium_Phone` API 33 Google Play x86_64 AVD was restored to stock ramdisk, cold-booted, rooted with the local upstream rootAVD clone as an oracle, cold-booted again, and verified with `su -c id -u == 0`. Added reusable scripts: `scripts/emulator-root-diagnostics.ps1` and `scripts/emulator-root-e2e.ps1`.

### 2026-04-26 — Tauri Dev OPS Crypto Import Fix

**Change:** Fixed `bun tauri dev` failing with `unresolved import aes::cipher::AsyncStreamCipher` after the lockfile resolved RustCrypto `aes 0.9` / `cfb-mode 0.9` / `cipher 0.5.1`. `cipher 0.5.1` no longer exports `AsyncStreamCipher`, and `cfb-mode 0.9` exposes `Decryptor::decrypt()` through its current API without that stale import.

**Files changed:** `src-tauri/src/payload/ops/crypto.rs`

**Verification:** `cargo check --manifest-path src-tauri/Cargo.toml --no-default-features --features local_zip,remote_zip` with isolated `CARGO_TARGET_DIR=src-tauri/target-codex-check` ✅ · `bun run format:check` ✅.

### 2026-04-26 — Emulator Root Magisk CPIO Backup Fix

**Change:** Fixed `Ramdisk patching failed` during the `magiskboot cpio ... 'backup ramdisk.cpio.orig'` step. The local rootAVD reference creates `ramdisk.cpio.orig` for stock ramdisks before patching; our pipeline computed the SHA1 but never created that original CPIO backup file. `patch_ramdisk_in_emulator()` now masks the `magiskboot cpio test` status with `status & 3`, creates and verifies `{ROOT_WORKDIR}/ramdisk.cpio.orig` for stock ramdisks, then runs the Magisk patch sequence.

**Files changed:** `src-tauri/src/emulator/root.rs`, `src/test/rootAvdPipeline.test.ts`

**Verification:** Added focused regression coverage proving `ramdisk.cpio.orig` is created before the patch command uses it. `bun vitest run src/test/rootAvdPipeline.test.ts` ✅. No production build was run.

### 2026-04-26 — Emulator Root Preflight Auto-Scan Loop Fix

**Change:** Fixed a rapid preflight scan loop in `RootWizard` when `scan_avd_root_readiness` rejects. The wizard now records that the automatic scan has already been attempted for the current AVD/serial while the preflight step is open, so a backend error no longer flips `isScanning` back to false and immediately re-enters the scan. Manual **Rescan** still runs explicitly.

**Files changed:** `src/components/emulator-manager/RootWizard.tsx`, `src/test/RootWizard.test.tsx`

**Verification:** `bun vitest run` ✅ (41/41 tests) · `bun tsc --noEmit` ✅ · `bun run format:check` ✅ · `bun run lint:web` ✅ · `bun run build` ✅ · isolated-target `bun run lint:rust` ✅. `bun run check` is still blocked by Windows `AdbWinApi.dll` file lock during default-target clippy; isolated-target `cargo test` compiles but still exits with the known Tauri-linked `STATUS_ENTRYPOINT_NOT_FOUND` loader failure.

### 2026-04-26 — Emulator Root Preflight Tauri Permission Fix

**Change:** Fixed `Preflight scan failed: scan_avd_root_readiness not allowed. Command not found` by adding `scan_avd_root_readiness` to `src-tauri/permissions/autogenerated.toml`. The command was already implemented and registered in `lib.rs`; Tauri was blocking it at the capability/ACL layer before dispatch.

**Files changed:** `src-tauri/permissions/autogenerated.toml`, `src/test/tauriPermissions.test.ts`

**Verification:** Added focused permission regression coverage. `bun vitest run src/test/tauriPermissions.test.ts src/test/RootWizard.test.tsx` ✅ · `bun run format:check` ✅ · `bun run lint:web` ✅. No production build was run for this permission-only fix.
