import * as core from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

import type { backend } from "./models";

const call = <T>(command: string, args?: Record<string, unknown>): Promise<T> =>
  core.invoke<T>(command, args);

const normalizeSingleSelection = (selection: string | null): string => selection ?? "";

const normalizeMultipleSelection = (selection: string | string[] | null): string[] => {
  if (Array.isArray(selection)) {
    return selection;
  }

  return selection ? [selection] : [];
};

const selectFile = async (options: Parameters<typeof open>[0]): Promise<string> =>
  normalizeSingleSelection(await open(options));

const selectFiles = async (options: Parameters<typeof open>[0]): Promise<string[]> =>
  normalizeMultipleSelection(await open(options));

const selectSavePath = async (options: Parameters<typeof save>[0]): Promise<string> =>
  normalizeSingleSelection(await save(options));

const DEFAULT_FILE_ACCESS_MODE: backend.FileAccessMode = "normal";

export const CleanupPayloadCache = (): Promise<void> => call("cleanup_payload_cache");

export const CreateCancellationToken = (): Promise<string> => call("create_cancellation_token");

export const CancelExtraction = (tokenId: string): Promise<void> =>
  call("cancel_extraction", { tokenId });

export const FinalizeAvdRoot = (
  request: backend.RootFinalizeRequest
): Promise<backend.RootFinalizeResult> => call("finalize_avd_root", { request });

export const ConnectWirelessAdb = (ip: string, port: string): Promise<string> =>
  call("connect_wireless_adb", { ip, port });

export const DisconnectWirelessAdb = (ip: string, port: string): Promise<string> =>
  call("disconnect_wireless_adb", { ip, port });

export const EnableWirelessAdb = (port: string, serial?: string | null): Promise<string> =>
  call("enable_wireless_adb", { port, serial });

export const ExtractPayload = (
  payloadPath: string,
  outputDir: string,
  selectedPartitions: string[],
  prefetch?: boolean,
  cancelTokenId?: string
): Promise<backend.ExtractPayloadResult> =>
  call("extract_payload", {
    cancelTokenId: cancelTokenId ?? null,
    outputDir,
    payloadPath,
    prefetch: prefetch ?? null,
    selectedPartitions,
  });

export const FlashPartition = (
  partition: string,
  imagePath: string,
  serial?: string | null
): Promise<void> => call("flash_partition", { imagePath, partition, serial });

export const GetAvdRestorePlan = (avdName: string): Promise<backend.RestorePlan> =>
  call("get_avd_restore_plan", { avdName });

export const GetDeviceInfo = (serial?: string | null): Promise<backend.DeviceInfo> =>
  call("get_device_info", { serial });

/**
 * Structured device telemetry — numbers, not display strings — in one adb round-trip.
 * Prefer this over {@link GetDeviceInfo} for anything charted, compared, or computed.
 */
export const GetDeviceTelemetry = (serial?: string | null): Promise<backend.DeviceTelemetry> =>
  call("get_device_telemetry", { serial: serial ?? null });

export const GetDevices = (): Promise<backend.Device[]> => call("get_devices");

export const GetFastbootDevices = (): Promise<backend.Device[]> => call("get_fastboot_devices");

export const GetInstalledPackages = (serial?: string | null): Promise<backend.InstalledPackage[]> =>
  call("get_installed_packages", { serial });

export const InstallPackage = (
  path: string,
  serial?: string | null,
  flags?: string[]
): Promise<string> => call("install_package", { flags, path, serial });

export const InspectPackageFile = (path: string): Promise<backend.ApkInspectionResult> =>
  call("inspect_package_file", { path });

export const PackageLifecycleOp = (
  packageName: string,
  op: string,
  serial?: string | null
): Promise<string> => call("package_lifecycle_op", { op, packageName, serial });

export const PullPackageApk = (
  packageName: string,
  destinationPath: string,
  serial?: string | null
): Promise<string> => call("pull_package_apk", { destinationPath, packageName, serial });

export const GetPackageDetails = (
  packageName: string,
  serial?: string | null
): Promise<backend.DetailedPackageInfo> => call("get_package_details", { packageName, serial });

export const LaunchAvd = (
  avdName: string,
  options: backend.EmulatorLaunchOptions
): Promise<string> => call("launch_avd", { avdName, options });

export const LaunchDeviceManager = (): Promise<void> => call("launch_device_manager");

export const LaunchTerminal = (): Promise<void> => call("launch_terminal");

export const ListAvds = (): Promise<backend.AvdSummary[]> => call("list_avds");

export const VerifyFileRootAccess = (serial?: string | null): Promise<string> =>
  call("verify_file_root_access", { serial });

export const ListFiles = (
  path: string,
  serial?: string | null,
  accessMode: backend.FileAccessMode = DEFAULT_FILE_ACCESS_MODE
): Promise<backend.FileEntry[]> => call("list_files", { accessMode, path, serial });

export const ListPayloadPartitionsWithDetails = (
  payloadPath: string
): Promise<backend.PartitionDetail[]> =>
  call("list_payload_partitions_with_details", { payloadPath });

export const OpenFolder = (folderPath: string): Promise<void> =>
  call("open_folder", { folderPath });

export const PullFile = (
  remotePath: string,
  localPath: string,
  serial?: string | null,
  accessMode: backend.FileAccessMode = DEFAULT_FILE_ACCESS_MODE
): Promise<string> => call("pull_file", { accessMode, localPath, remotePath, serial });

export const PrepareAvdRoot = (
  request: backend.RootPreparationRequest
): Promise<backend.RootPreparationResult> => call("prepare_avd_root", { request });

export const PushFile = (
  localPath: string,
  remotePath: string,
  serial?: string | null,
  accessMode: backend.FileAccessMode = DEFAULT_FILE_ACCESS_MODE
): Promise<string> => call("push_file", { accessMode, localPath, remotePath, serial });

export const HostPathKinds = (paths: string[]): Promise<backend.HostPathKind[]> =>
  call("host_path_kinds", { paths });

export const CreateDirectory = (
  path: string,
  serial?: string | null,
  accessMode: backend.FileAccessMode = DEFAULT_FILE_ACCESS_MODE
): Promise<string> => call("create_directory", { accessMode, path, serial });

export const CreateFile = (
  path: string,
  serial?: string | null,
  accessMode: backend.FileAccessMode = DEFAULT_FILE_ACCESS_MODE
): Promise<string> => call("create_file", { accessMode, path, serial });

export const DeleteFiles = (
  paths: string[],
  serial?: string | null,
  accessMode: backend.FileAccessMode = DEFAULT_FILE_ACCESS_MODE
): Promise<string> => call("delete_files", { accessMode, paths, serial });

export const TransferDeviceFiles = (
  mode: backend.DeviceTransferMode,
  sources: string[],
  destDir: string,
  overwrite: boolean,
  serial: string | null | undefined,
  clipboardSerial: string,
  accessMode: backend.FileAccessMode = DEFAULT_FILE_ACCESS_MODE
): Promise<backend.DeviceTransferResult> =>
  call("transfer_device_files", {
    accessMode,
    clipboardSerial,
    destDir,
    mode,
    overwrite,
    serial,
    sources,
  });

export const RenameFile = (
  oldPath: string,
  newPath: string,
  serial?: string | null,
  accessMode: backend.FileAccessMode = DEFAULT_FILE_ACCESS_MODE
): Promise<string> => call("rename_file", { accessMode, newPath, oldPath, serial });

export const Reboot = (mode: string, serial?: string | null): Promise<void> =>
  call("reboot", { mode, serial });

export const RestartAdbServer = (): Promise<string> => call("restart_adb_server");

export const KillAdbServer = (): Promise<string> => call("kill_adb_server");

export const GetHostToolVersions = (): Promise<backend.HostToolVersions> =>
  call("get_host_tool_versions");

export const HostSetupStatus = (): Promise<backend.HostSetupStatus> => call("host_setup_status");

export const HostSetupInstall = (): Promise<backend.HostSetupResult> => call("host_setup_install");

export const HostSetupInstallDriver = (): Promise<backend.HostSetupResult> =>
  call("host_setup_install_driver");

export const LaunchHostSetupTerminal = (): Promise<void> => call("launch_host_setup_terminal");

export const HostSetupRepairPath = (): Promise<backend.HostSetupResult> =>
  call("host_setup_repair_path");

export const RestoreAvdBackups = (avdName: string): Promise<string> =>
  call("restore_avd_backups", { avdName });

export const RunAdbHostCommand = (command: string): Promise<string> =>
  call("run_adb_host_command", { command });

export const RunFastbootHostCommand = (command: string, serial?: string | null): Promise<string> =>
  call("run_fastboot_host_command", { command, serial });

export const RunShellCommand = (command: string, serial?: string | null): Promise<string> =>
  call("run_shell_command", { command, serial });

export const SaveLog = (content: string, prefix: string): Promise<string> =>
  call("save_log", { content, prefix });

export const SaveScreenshot = (destPath: string, serial?: string | null): Promise<string> =>
  call("save_screenshot", { destPath, serial: serial ?? null });

export const SelectDirectoryForPull = (): Promise<string> =>
  selectFile({
    directory: true,
  });

export const SelectDirectoryToPush = (): Promise<string> =>
  selectFile({
    directory: true,
  });

export const SelectFileToPush = (): Promise<string> => selectFile({});

export const SelectImageFile = (): Promise<string> =>
  selectFile({
    filters: [
      {
        extensions: ["img"],
        name: "Image files",
      },
    ],
  });

export const SelectMultipleApkFiles = (): Promise<string[]> =>
  selectFiles({
    filters: [
      {
        extensions: ["apk", "apks", "xapk", "apkm"],
        name: "Android Package files",
      },
    ],
    multiple: true,
  });

export const SelectOutputDirectory = (): Promise<string> =>
  selectFile({
    directory: true,
  });

export const SelectPayloadFile = (): Promise<string> =>
  selectFile({
    filters: [
      {
        extensions: ["bin", "zip", "ops", "ofp"],
        name: "Payload files",
      },
    ],
  });

export const SelectSaveDirectory = (defaultPath: string): Promise<string> =>
  selectSavePath({
    defaultPath,
  });

export const SelectScreenshotPng = (): Promise<string> =>
  selectSavePath({
    defaultPath: "screenshot.png",
    filters: [{ extensions: ["png"], name: "PNG image" }],
  });

export const SelectZipFile = (): Promise<string> =>
  selectFile({
    filters: [
      {
        extensions: ["zip"],
        name: "ZIP files",
      },
    ],
  });

export const SetActiveSlot = (slot: string, serial?: string | null): Promise<void> =>
  call("set_active_slot", { serial: serial ?? null, slot });

export const SideloadPackage = (path: string, serial?: string | null): Promise<string> =>
  call("sideload_package", { path, serial });

export const SelectRootPackageFile = (): Promise<string> =>
  selectFile({
    filters: [
      {
        extensions: ["apk", "zip"],
        name: "Root packages",
      },
    ],
  });

export const SelectPatchedRootImageFile = (): Promise<string> =>
  selectFile({
    filters: [
      {
        extensions: ["img"],
        name: "Patched boot images",
      },
    ],
  });

/** Fetch the latest official stable Magisk release from the GitHub releases API. */
export const FetchMagiskStableRelease = (): Promise<backend.MagiskStableRelease> =>
  call("fetch_magisk_stable_release");

/** Root an AVD using the automated magiskboot pipeline. Emits root:progress events. */
export const RootAvd = (request: backend.RootAvdRequest): Promise<backend.RootAvdResult> =>
  call("root_avd", { request });

/** Run the pre-flight readiness scan for an AVD. Fast (~1-2s). */
export const ScanAvdRootReadiness = (
  avdName: string,
  serial?: string | null
): Promise<backend.RootReadinessScan> =>
  call("scan_avd_root_readiness", { avdName, serial: serial ?? null });

/** Verify that a cold-booted AVD has working Magisk root. */
export const VerifyAvdRoot = (
  avdName: string,
  serial: string
): Promise<backend.RootVerificationResult> => call("verify_avd_root", { avdName, serial });

export const UninstallPackage = (packageName: string, serial?: string | null): Promise<string> =>
  call("uninstall_package", { packageName, serial });

export const StopAvd = (serial: string): Promise<string> => call("stop_avd", { serial });

export const WipeData = (serial?: string | null, confirm?: string | null): Promise<void> =>
  call("wipe_data", {
    confirm: confirm ?? null,
    serial: serial ?? null,
  });

// =============================================================================
// Remote URL Payload Commands
// =============================================================================

/**
 * Check if a remote URL supports HTTP range requests and get file size.
 * Returns error if the server doesn't support range requests.
 */
export const CheckRemotePayload = (url: string): Promise<backend.RemotePayloadInfo> =>
  call("check_remote_payload", { url });

/**
 * List partition names and sizes from a remote payload URL.
 * Downloads the payload manifest via HTTP range requests.
 */
export const ListRemotePayloadPartitions = (url: string): Promise<backend.PartitionDetail[]> =>
  call("list_remote_payload_partitions", { url });

/**
 * Get full metadata (HTTP headers + ZIP structure + OTA manifest) for a remote payload.
 * Call after partitions are loaded — re-reads the manifest to extract metadata fields.
 */
export const GetRemotePayloadMetadata = (url: string): Promise<backend.RemotePayloadMetadata> =>
  call("get_remote_payload_metadata", { url });

// =============================================================================
// Marketplace Commands
// =============================================================================

/** Search apps across all marketplace providers (F-Droid, GitHub, Aptoide). */
export const MarketplaceSearch = (
  query: string,
  filters?: backend.MarketplaceSearchFilters
): Promise<backend.MarketplaceApp[]> =>
  call("marketplace_search", { filters: filters ?? null, query });

/**
 * Get detailed info about a single app from a specific provider.
 *
 * `repoUrl` / `downloadUrl` are optional resolution hints from the row the
 * user opened (search results and curated tools already know the repo); the
 * backend uses them to pin the GitHub lookup instead of guessing from the
 * package ID.
 */
export const MarketplaceGetAppDetail = (
  packageName: string,
  source: string,
  githubToken?: string | null,
  repoUrl?: string | null,
  downloadUrl?: string | null
): Promise<backend.MarketplaceAppDetail> =>
  call("marketplace_get_app_detail", {
    downloadUrl: downloadUrl ?? null,
    githubToken: githubToken ?? null,
    packageName,
    repoUrl: repoUrl ?? null,
    source,
  });

export const MarketplaceRenderMarkdown = (
  markdown: string,
  owner?: string,
  repo?: string,
  defaultBranch?: string
): Promise<string> =>
  call("marketplace_render_markdown", {
    defaultBranch: defaultBranch ?? null,
    markdown,
    owner: owner ?? null,
    repo: repo ?? null,
  });

/** Clear backend marketplace caches. */
export const MarketplaceClearCache = (): Promise<string> => call("marketplace_clear_cache");

/** Start GitHub device-flow authentication. */
export const MarketplaceGithubDeviceStart = (
  clientId: string,
  scopes: string[] = []
): Promise<backend.GithubDeviceFlowChallenge> =>
  call("marketplace_github_device_start", {
    clientId,
    scopes,
  });

/** Poll GitHub device-flow authentication. */
export const MarketplaceGithubDevicePoll = (
  clientId: string,
  deviceCode: string
): Promise<backend.GithubDeviceFlowPollResult> =>
  call("marketplace_github_device_poll", {
    clientId,
    deviceCode,
  });

/** Download an APK from a URL to a temp directory. Returns the local file path. */
export const MarketplaceDownloadApk = (
  url: string,
  packageName?: string,
  downloadId?: string
): Promise<string> =>
  call("marketplace_download_apk", {
    downloadId: downloadId ?? null,
    packageName: packageName ?? null,
    url,
  });

/** Install a downloaded APK via ADB on the selected device when serial is set. */
export const MarketplaceInstallApk = (apkPath: string, serial?: string | null): Promise<string> =>
  call("marketplace_install_apk", { apkPath, serial });

// ── Debloater ────────────────────────────────────────────────────────────────

/** Load UAD lists from remote/cache/bundled. Returns status info. */
export const LoadDebloatLists = (): Promise<backend.DebloatListStatus> =>
  call("load_debloat_lists");

/** Get all system packages merged with UAD metadata. */
export const GetDebloatPackages = (serial?: string | null): Promise<backend.DebloatPackageRow[]> =>
  call("get_debloat_packages", { serial: serial ?? null });

/** Apply an action to a batch of packages. action: 'uninstall' | 'disable' | 'restore'. */
export const DebloatPackages = (
  packages: string[],
  action: backend.DebloatAction,
  user = 0,
  serial?: string | null
): Promise<backend.DebloatActionResult[]> =>
  call("debloat_packages", {
    action,
    packages,
    serial: serial ?? null,
    user,
  });

/** Create a backup snapshot of current package states. */
export const CreateDebloatBackup = (
  packages: backend.PackageSnapshot[],
  serial?: string | null
): Promise<backend.BackupSummary> =>
  call("create_debloat_backup", { packages, serial: serial ?? null });

/** List all available backups for the selected device. */
export const ListDebloatBackups = (serial?: string | null): Promise<backend.BackupSummary[]> =>
  call("list_debloat_backups", { serial: serial ?? null });

/**
 * Restore a previously created backup by file name, reapplying each package's recorded
 * state. `fileName` comes from {@link backend.BackupSummary.fileName}.
 */
export const RestoreDebloatBackup = (
  fileName: string,
  serial?: string | null
): Promise<backend.DebloatActionResult[]> =>
  call("restore_debloat_backup", { fileName, serial: serial ?? null });

/** Get per-device settings (expert mode, disable mode, multi-user mode). */
export const GetDebloatDeviceSettings = (
  serial?: string | null
): Promise<backend.PerDeviceSettings> =>
  call("get_debloat_device_settings", { serial: serial ?? null });

/** Save per-device settings. */
export const SaveDebloatDeviceSettings = (
  settings: backend.PerDeviceSettings,
  serial?: string | null
): Promise<void> =>
  call("save_debloat_device_settings", {
    serial: serial ?? null,
    settings,
  });

/** Combined response for all initial debloater data. */
export type DebloatData = backend.DebloatData;

/** Get all debloater data in one call. Uses in-memory cache when available. */
export const GetDebloatData = (serial?: string | null): Promise<backend.DebloatData> =>
  call("get_debloat_data", { serial: serial ?? null });

/** Force refresh debloater data for the selected device. */
export const RefreshDebloatData = (serial?: string | null): Promise<backend.DebloatData> =>
  call("refresh_debloat_data", { serial: serial ?? null });

export const GetAppIcons = (
  packages: string[],
  serial?: string | null
): Promise<backend.AppIcon[]> => call("get_app_icons", { packages, serial: serial ?? null });

export const OpenDeviceFileInEditor = (
  remotePath: string,
  serial?: string | null,
  accessMode: backend.FileAccessMode = DEFAULT_FILE_ACCESS_MODE,
  target: backend.DeviceEditorTarget = "default"
): Promise<string> =>
  call("open_device_file_in_editor", {
    accessMode,
    remotePath,
    serial,
    target,
  });

export const RevealDevicePathInExplorer = (
  remotePath: string,
  serial?: string | null
): Promise<string> =>
  call("reveal_device_path_in_explorer", {
    remotePath,
    serial: serial ?? null,
  });

export const GetLogcatSnapshot = (serial?: string | null, lines?: number): Promise<string> =>
  call("get_logcat_snapshot", {
    lines: lines ?? null,
    serial: serial ?? null,
  });

export const ScrcpyStatus = (): Promise<backend.ScrcpyStatus> => call("scrcpy_status");

export const ScrcpyCheckUpdate = (): Promise<backend.ScrcpyStatus> => call("scrcpy_check_update");

export const ScrcpyInstall = (): Promise<backend.ScrcpyStatus> => call("scrcpy_install");

export const ScrcpyUninstall = (): Promise<backend.ScrcpyStatus> => call("scrcpy_uninstall");

export const ScrcpyLaunch = (
  options: backend.ScrcpyLaunchOptions,
  serial?: string | null
): Promise<void> => call("scrcpy_launch", { options, serial: serial ?? null });

export const ScrcpyStop = (serial?: string | null): Promise<void> =>
  call("scrcpy_stop", { serial: serial ?? null });

export const ScrcpyActiveSessions = (): Promise<backend.ScrcpyActiveSessions> =>
  call("scrcpy_active_sessions");

export const ScrcpyPresets = (): Promise<backend.ScrcpyPresetsCatalog> => call("scrcpy_presets");

export const ScrcpyOpenToolbar = (
  serial: string,
  pid?: number | null,
  mode?: backend.ToolbarMode,
  side?: backend.ToolbarSide
): Promise<void> =>
  call("scrcpy_open_toolbar", {
    mode: mode ?? null,
    pid: pid ?? null,
    serial,
    side: side ?? null,
  });

export const ScrcpyCloseToolbar = (serial: string): Promise<void> =>
  call("scrcpy_close_toolbar", { serial });

export const ScrcpyGetToolbarState = (serial: string): Promise<backend.ToolbarSession | null> =>
  call("scrcpy_get_toolbar_state", { serial });

export const ScrcpySetToolbarMode = (serial: string, mode: backend.ToolbarMode): Promise<void> =>
  call("scrcpy_set_toolbar_mode", { mode, serial });

export const ScrcpySetToolbarOffset = (serial: string, offset: number): Promise<void> =>
  call("scrcpy_set_toolbar_offset", { offset, serial });

export const ScrcpySetToolbarSide = (serial: string, side: backend.ToolbarSide): Promise<void> =>
  call("scrcpy_set_toolbar_side", { serial, side });

export const ScrcpySetToolbarSize = (
  serial: string,
  width: number,
  height: number
): Promise<void> => call("scrcpy_set_toolbar_size", { height, serial, width });

export const ScrcpySendKeyevent = (serial: string, keycode: number): Promise<void> =>
  call("scrcpy_send_keyevent", { keycode, serial });

export const ScrcpySendStatusbar = (
  serial: string,
  action: "expand-notifications" | "expand-settings" | "collapse"
): Promise<void> => call("scrcpy_send_statusbar", { action, serial });

export const ScrcpyRotateDevice = (
  serial: string,
  direction: "clockwise" | "counter-clockwise" | "natural"
): Promise<void> => call("scrcpy_rotate_device", { direction, serial });

export const ScrcpyTakeScreenshot = (serial: string): Promise<string> =>
  call("scrcpy_take_screenshot", { serial });

// --- App Manager & Debloater Backend APIs ---
export const GetAppOverviewTelemetry = (
  serial?: string | null
): Promise<backend.AppOverviewTelemetry> =>
  call("get_app_overview_telemetry", { serial: serial ?? null });

export const BatchInspectPackages = (paths: string[]): Promise<backend.ApkInspectionResult[]> =>
  call("batch_inspect_package_files", { paths });

export const BatchInstallPackages = (
  paths: string[],
  serial?: string | null,
  flags?: string[]
): Promise<backend.BatchInstallResult[]> =>
  call("batch_install_packages", {
    flags: flags ?? [],
    paths,
    serial: serial ?? null,
  });

// --- Flasher Backend APIs ---
export const GetFlasherVitals = (serial?: string | null): Promise<backend.FlasherVitalsResult> =>
  call("get_flasher_vitals", { serial: serial ?? null });

export const InspectPartitionImage = (filePath: string): Promise<backend.PartitionTargetInfo> =>
  call("inspect_partition_image", { filePath });

export const FlashPartitionBatch = (
  items: backend.BatchFlashItem[],
  serial?: string | null
): Promise<void> => call("flash_partition_batch", { items, serial: serial ?? null });

export const SideloadPackageStream = (zipPath: string, serial?: string | null): Promise<void> =>
  call("sideload_package_stream", { serial: serial ?? null, zipPath });

export const ErasePartition = (
  partition: string,
  confirmPhrase: string,
  serial?: string | null
): Promise<void> =>
  call("erase_partition", {
    confirmPhrase,
    partition,
    serial: serial ?? null,
  });

// --- Scrcpy & Emulator Backend APIs ---
export const ScrcpyPreviewCommand = (
  options: backend.ScrcpyLaunchOptions,
  serial?: string | null
): Promise<backend.ScrcpyCommandPreview> =>
  call("scrcpy_preview_command", { options, serial: serial ?? null });

export const ScrcpyProfiles = (): Promise<backend.ScrcpyQualityProfile[]> =>
  call("scrcpy_profiles");

export const ScrcpyCalculateBandwidthMetrics = (
  bitrate?: string | null
): Promise<backend.BandwidthMetrics> =>
  call("scrcpy_calculate_bandwidth_metrics", {
    bitrate: bitrate ?? null,
  });

export const ScrcpyToolbarAction = (serial: string, action: string): Promise<void> =>
  call("scrcpy_toolbar_action", { action, serial });

export const EmulatorGetAvdSpecs = (avdName: string): Promise<backend.AvdHardwareDetails> =>
  call("emulator_get_avd_specs", { avdName });

export const EmulatorGetDiskBreakdown = (avdName: string): Promise<backend.AvdDiskBreakdown> =>
  call("emulator_get_disk_breakdown", { avdName });

export const GetHostHardwareCapacity = (): Promise<backend.HostHardwareCapacity> =>
  call("system_host_resources");

// --- Marketplace, Payload, System & Device Backend APIs ---
export const MarketplaceCheckUpdates = (
  serial?: string | null
): Promise<backend.AppUpdateCandidate[]> =>
  call("marketplace_check_updates", { serial: serial ?? null });

export const MarketplaceGetOverviewStats = (): Promise<backend.MarketplaceOverviewStats> =>
  call("marketplace_get_overview_stats");

export const MarketplaceGetTokenStatus = (): Promise<backend.MarketplaceTokenStatus> =>
  call("marketplace_get_token_status");

export const MarketplaceSavePat = (token: string): Promise<backend.MarketplaceTokenStatus> =>
  call("marketplace_save_pat", { token });

export const MarketplaceLogout = (): Promise<string> => call("marketplace_logout");

export const MarketplaceGithubWebAuthFlow = (
  clientId?: string | null
): Promise<backend.MarketplaceTokenStatus> =>
  call("marketplace_github_web_auth_flow", {
    clientId: clientId ?? null,
  });

export const MarketplaceGetRateLimit = (): Promise<backend.MarketplaceRateLimitStatus | null> =>
  call("marketplace_get_rate_limit");

export const MarketplaceGetHostTokens = (): Promise<backend.MarketplaceHostTokenEntry[]> =>
  call("marketplace_get_host_tokens");

export const MarketplaceSaveHostToken = (
  host: string,
  token: string,
  displayName?: string | null
): Promise<backend.MarketplaceHostTokenEntry[]> =>
  call("marketplace_save_host_token", {
    displayName: displayName ?? null,
    host,
    token,
  });

export const MarketplaceRemoveHostToken = (
  host: string
): Promise<backend.MarketplaceHostTokenEntry[]> => call("marketplace_remove_host_token", { host });

export const MarketplaceGetCuratedFeed = (category: string): Promise<unknown[]> =>
  call("marketplace_get_curated_feed", { category });

export const ComputePartitionFileSha256 = (filePath: string): Promise<string> =>
  call("compute_partition_file_sha256", { filePath });

export const GetExtractionPresets = (): Promise<backend.PayloadExtractionPreset[]> =>
  call("get_extraction_presets");

export const GetAllDevices = (): Promise<backend.DeviceEntry[]> => call("get_all_devices");

export const ExecuteCliCommand = (
  command: string,
  serial?: string | null
): Promise<backend.CliExecutionResult> =>
  call("execute_cli_command", { command, serial: serial ?? null });

export const GetFirmwareCatalog = (
  brand?: backend.FirmwareBrand,
  forceRefresh?: boolean
): Promise<backend.FirmwareDeviceModel[]> =>
  call("get_firmware_catalog", {
    brand: brand ?? null,
    forceRefresh: forceRefresh ?? false,
  });

export const RefreshFirmwareCatalog = (
  brand?: backend.FirmwareBrand
): Promise<backend.FirmwareDeviceModel[]> =>
  call("refresh_firmware_catalog", {
    brand: brand ?? null,
  });

export const GetSupportedFirmwareBrands = (): Promise<backend.FirmwareBrand[]> =>
  call("get_supported_firmware_brands");

export const ClearFirmwareCache = (brand?: backend.FirmwareBrand): Promise<void> =>
  call("clear_firmware_cache", {
    brand: brand ?? null,
  });

export const UnpackSuperImage = (
  superPath: string,
  outputDir: string
): Promise<[string, number][]> =>
  call("unpack_super_image", {
    outputDir,
    superPath,
  });
