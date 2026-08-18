import * as core from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import type { backend } from './models';

function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  return core.invoke<T>(command, args);
}

function normalizeSingleSelection(selection: string | null): string {
  return selection ?? '';
}

function normalizeMultipleSelection(selection: string | string[] | null): string[] {
  if (Array.isArray(selection)) {
    return selection;
  }

  return selection ? [selection] : [];
}

async function selectFile(options: Parameters<typeof open>[0]): Promise<string> {
  return normalizeSingleSelection(await open(options));
}

async function selectFiles(options: Parameters<typeof open>[0]): Promise<string[]> {
  return normalizeMultipleSelection(await open(options));
}

async function selectSavePath(options: Parameters<typeof save>[0]): Promise<string> {
  return normalizeSingleSelection(await save(options));
}

const DEFAULT_FILE_ACCESS_MODE: backend.FileAccessMode = 'normal';

export function CleanupPayloadCache(): Promise<void> {
  return call('cleanup_payload_cache');
}

export function CreateCancellationToken(): Promise<string> {
  return call('create_cancellation_token');
}

export function CancelExtraction(tokenId: string): Promise<void> {
  return call('cancel_extraction', { tokenId });
}

export function FinalizeAvdRoot(
  request: backend.RootFinalizeRequest,
): Promise<backend.RootFinalizeResult> {
  return call('finalize_avd_root', { request });
}

export function ConnectWirelessAdb(ip: string, port: string): Promise<string> {
  return call('connect_wireless_adb', { ip, port });
}

export function DisconnectWirelessAdb(ip: string, port: string): Promise<string> {
  return call('disconnect_wireless_adb', { ip, port });
}

export function EnableWirelessAdb(port: string, serial?: string | null): Promise<string> {
  return call('enable_wireless_adb', { port, serial });
}

export function ExtractPayload(
  payloadPath: string,
  outputDir: string,
  selectedPartitions: string[],
  prefetch?: boolean,
  cancelTokenId?: string,
): Promise<backend.ExtractPayloadResult> {
  return call('extract_payload', {
    payloadPath,
    outputDir,
    selectedPartitions,
    prefetch: prefetch ?? null,
    cancelTokenId: cancelTokenId ?? null,
  });
}

export function FlashPartition(
  partition: string,
  imagePath: string,
  serial?: string | null,
): Promise<void> {
  return call('flash_partition', { partition, imagePath, serial });
}

export function GetAvdRestorePlan(avdName: string): Promise<backend.RestorePlan> {
  return call('get_avd_restore_plan', { avdName });
}

export function GetDeviceInfo(serial?: string | null): Promise<backend.DeviceInfo> {
  return call('get_device_info', { serial });
}

/**
 * Structured device telemetry — numbers, not display strings — in one adb round-trip.
 * Prefer this over {@link GetDeviceInfo} for anything charted, compared, or computed.
 */
export function GetDeviceTelemetry(serial?: string | null): Promise<backend.DeviceTelemetry> {
  return call('get_device_telemetry', { serial: serial ?? null });
}

export function GetDevices(): Promise<backend.Device[]> {
  return call('get_devices');
}

export function GetFastbootDevices(): Promise<backend.Device[]> {
  return call('get_fastboot_devices');
}

export function GetInstalledPackages(serial?: string | null): Promise<backend.InstalledPackage[]> {
  return call('get_installed_packages', { serial });
}

export function InstallPackage(
  path: string,
  serial?: string | null,
  flags?: string[],
): Promise<string> {
  return call('install_package', { path, serial, flags });
}

export function InspectPackageFile(path: string): Promise<backend.ApkInspectionResult> {
  return call('inspect_package_file', { path });
}

export function PackageLifecycleOp(
  packageName: string,
  op: string,
  serial?: string | null,
): Promise<string> {
  return call('package_lifecycle_op', { packageName, op, serial });
}

export function PullPackageApk(
  packageName: string,
  destinationPath: string,
  serial?: string | null,
): Promise<string> {
  return call('pull_package_apk', { packageName, destinationPath, serial });
}

export function GetPackageDetails(
  packageName: string,
  serial?: string | null,
): Promise<backend.DetailedPackageInfo> {
  return call('get_package_details', { packageName, serial });
}

export function LaunchAvd(
  avdName: string,
  options: backend.EmulatorLaunchOptions,
): Promise<string> {
  return call('launch_avd', { avdName, options });
}

export function LaunchDeviceManager(): Promise<void> {
  return call('launch_device_manager');
}

export function LaunchTerminal(): Promise<void> {
  return call('launch_terminal');
}

export function ListAvds(): Promise<backend.AvdSummary[]> {
  return call('list_avds');
}

export function VerifyFileRootAccess(serial?: string | null): Promise<string> {
  return call('verify_file_root_access', { serial });
}

export function ListFiles(
  path: string,
  serial?: string | null,
  accessMode: backend.FileAccessMode = DEFAULT_FILE_ACCESS_MODE,
): Promise<backend.FileEntry[]> {
  return call('list_files', { path, serial, accessMode });
}

export function ListPayloadPartitionsWithDetails(
  payloadPath: string,
): Promise<backend.PartitionDetail[]> {
  return call('list_payload_partitions_with_details', { payloadPath });
}

export function OpenFolder(folderPath: string): Promise<void> {
  return call('open_folder', { folderPath });
}

export function PullFile(
  remotePath: string,
  localPath: string,
  serial?: string | null,
  accessMode: backend.FileAccessMode = DEFAULT_FILE_ACCESS_MODE,
): Promise<string> {
  return call('pull_file', { remotePath, localPath, serial, accessMode });
}

export function PrepareAvdRoot(
  request: backend.RootPreparationRequest,
): Promise<backend.RootPreparationResult> {
  return call('prepare_avd_root', { request });
}

export function PushFile(
  localPath: string,
  remotePath: string,
  serial?: string | null,
  accessMode: backend.FileAccessMode = DEFAULT_FILE_ACCESS_MODE,
): Promise<string> {
  return call('push_file', { localPath, remotePath, serial, accessMode });
}

export function HostPathKinds(paths: string[]): Promise<backend.HostPathKind[]> {
  return call('host_path_kinds', { paths });
}

export function CreateDirectory(
  path: string,
  serial?: string | null,
  accessMode: backend.FileAccessMode = DEFAULT_FILE_ACCESS_MODE,
): Promise<string> {
  return call('create_directory', { path, serial, accessMode });
}

export function CreateFile(
  path: string,
  serial?: string | null,
  accessMode: backend.FileAccessMode = DEFAULT_FILE_ACCESS_MODE,
): Promise<string> {
  return call('create_file', { path, serial, accessMode });
}

export function DeleteFiles(
  paths: string[],
  serial?: string | null,
  accessMode: backend.FileAccessMode = DEFAULT_FILE_ACCESS_MODE,
): Promise<string> {
  return call('delete_files', { paths, serial, accessMode });
}

export function TransferDeviceFiles(
  mode: backend.DeviceTransferMode,
  sources: string[],
  destDir: string,
  overwrite: boolean,
  serial: string | null | undefined,
  clipboardSerial: string,
  accessMode: backend.FileAccessMode = DEFAULT_FILE_ACCESS_MODE,
): Promise<backend.DeviceTransferResult> {
  return call('transfer_device_files', {
    accessMode,
    clipboardSerial,
    destDir,
    mode,
    overwrite,
    serial,
    sources,
  });
}

export function RenameFile(
  oldPath: string,
  newPath: string,
  serial?: string | null,
  accessMode: backend.FileAccessMode = DEFAULT_FILE_ACCESS_MODE,
): Promise<string> {
  return call('rename_file', { oldPath, newPath, serial, accessMode });
}

export function Reboot(mode: string, serial?: string | null): Promise<void> {
  return call('reboot', { mode, serial });
}

export function RestartAdbServer(): Promise<string> {
  return call('restart_adb_server');
}

export function KillAdbServer(): Promise<string> {
  return call('kill_adb_server');
}

export function GetHostToolVersions(): Promise<backend.HostToolVersions> {
  return call('get_host_tool_versions');
}

export function HostSetupStatus(): Promise<backend.HostSetupStatus> {
  return call('host_setup_status');
}

export function HostSetupInstall(): Promise<backend.HostSetupResult> {
  return call('host_setup_install');
}

export function HostSetupInstallDriver(): Promise<backend.HostSetupResult> {
  return call('host_setup_install_driver');
}

export function LaunchHostSetupTerminal(): Promise<void> {
  return call('launch_host_setup_terminal');
}

export function HostSetupRepairPath(): Promise<backend.HostSetupResult> {
  return call('host_setup_repair_path');
}

export function RestoreAvdBackups(avdName: string): Promise<string> {
  return call('restore_avd_backups', { avdName });
}

export function RunAdbHostCommand(command: string): Promise<string> {
  return call('run_adb_host_command', { command });
}

export function RunFastbootHostCommand(command: string, serial?: string | null): Promise<string> {
  return call('run_fastboot_host_command', { command, serial });
}

export function RunShellCommand(command: string, serial?: string | null): Promise<string> {
  return call('run_shell_command', { command, serial });
}

export function SaveLog(content: string, prefix: string): Promise<string> {
  return call('save_log', { content, prefix });
}

export function SaveScreenshot(destPath: string, serial?: string | null): Promise<string> {
  return call('save_screenshot', { destPath, serial: serial ?? null });
}

export function SelectDirectoryForPull(): Promise<string> {
  return selectFile({
    directory: true,
  });
}

export function SelectDirectoryToPush(): Promise<string> {
  return selectFile({
    directory: true,
  });
}

export function SelectFileToPush(): Promise<string> {
  return selectFile({});
}

export function SelectImageFile(): Promise<string> {
  return selectFile({
    filters: [
      {
        name: 'Image files',
        extensions: ['img'],
      },
    ],
  });
}

export function SelectMultipleApkFiles(): Promise<string[]> {
  return selectFiles({
    multiple: true,
    filters: [
      {
        name: 'Android Package files',
        extensions: ['apk', 'apks', 'xapk', 'apkm'],
      },
    ],
  });
}

export function SelectOutputDirectory(): Promise<string> {
  return selectFile({
    directory: true,
  });
}

export function SelectPayloadFile(): Promise<string> {
  return selectFile({
    filters: [
      {
        name: 'Payload files',
        extensions: ['bin', 'zip', 'ops', 'ofp'],
      },
    ],
  });
}

export function SelectSaveDirectory(defaultPath: string): Promise<string> {
  return selectSavePath({
    defaultPath,
  });
}

export function SelectScreenshotPng(): Promise<string> {
  return selectSavePath({
    defaultPath: 'screenshot.png',
    filters: [{ name: 'PNG image', extensions: ['png'] }],
  });
}

export function SelectZipFile(): Promise<string> {
  return selectFile({
    filters: [
      {
        name: 'ZIP files',
        extensions: ['zip'],
      },
    ],
  });
}

export function SetActiveSlot(slot: string, serial?: string | null): Promise<void> {
  return call('set_active_slot', { slot, serial: serial ?? null });
}

export function SideloadPackage(path: string, serial?: string | null): Promise<string> {
  return call('sideload_package', { path, serial });
}

export function SelectRootPackageFile(): Promise<string> {
  return selectFile({
    filters: [
      {
        name: 'Root packages',
        extensions: ['apk', 'zip'],
      },
    ],
  });
}

export function SelectPatchedRootImageFile(): Promise<string> {
  return selectFile({
    filters: [
      {
        name: 'Patched boot images',
        extensions: ['img'],
      },
    ],
  });
}

/** Fetch the latest official stable Magisk release from the GitHub releases API. */
export function FetchMagiskStableRelease(): Promise<backend.MagiskStableRelease> {
  return call('fetch_magisk_stable_release');
}

/** Root an AVD using the automated magiskboot pipeline. Emits root:progress events. */
export function RootAvd(request: backend.RootAvdRequest): Promise<backend.RootAvdResult> {
  return call('root_avd', { request });
}

/** Run the pre-flight readiness scan for an AVD. Fast (~1-2s). */
export function ScanAvdRootReadiness(
  avdName: string,
  serial?: string | null,
): Promise<backend.RootReadinessScan> {
  return call('scan_avd_root_readiness', { avdName, serial: serial ?? null });
}

/** Verify that a cold-booted AVD has working Magisk root. */
export function VerifyAvdRoot(
  avdName: string,
  serial: string,
): Promise<backend.RootVerificationResult> {
  return call('verify_avd_root', { avdName, serial });
}

export function UninstallPackage(packageName: string, serial?: string | null): Promise<string> {
  return call('uninstall_package', { packageName, serial });
}

export function StopAvd(serial: string): Promise<string> {
  return call('stop_avd', { serial });
}

export function WipeData(serial?: string | null, confirm?: string | null): Promise<void> {
  return call('wipe_data', { serial: serial ?? null, confirm: confirm ?? null });
}

// =============================================================================
// Remote URL Payload Commands
// =============================================================================

/**
 * Check if a remote URL supports HTTP range requests and get file size.
 * Returns error if the server doesn't support range requests.
 */
export function CheckRemotePayload(url: string): Promise<backend.RemotePayloadInfo> {
  return call('check_remote_payload', { url });
}

/**
 * List partition names and sizes from a remote payload URL.
 * Downloads the payload manifest via HTTP range requests.
 */
export function ListRemotePayloadPartitions(url: string): Promise<backend.PartitionDetail[]> {
  return call('list_remote_payload_partitions', { url });
}

/**
 * Get full metadata (HTTP headers + ZIP structure + OTA manifest) for a remote payload.
 * Call after partitions are loaded — re-reads the manifest to extract metadata fields.
 */
export function GetRemotePayloadMetadata(url: string): Promise<backend.RemotePayloadMetadata> {
  return call('get_remote_payload_metadata', { url });
}

// =============================================================================
// Marketplace Commands
// =============================================================================

/** Search apps across all marketplace providers (F-Droid, GitHub, Aptoide). */
export function MarketplaceSearch(
  query: string,
  filters?: backend.MarketplaceSearchFilters,
): Promise<backend.MarketplaceApp[]> {
  return call('marketplace_search', { query, filters: filters ?? null });
}

/** Get detailed info about a single app from a specific provider. */
export function MarketplaceGetAppDetail(
  packageName: string,
  source: string,
  githubToken?: string | null,
): Promise<backend.MarketplaceAppDetail> {
  return call('marketplace_get_app_detail', {
    packageName,
    source,
    githubToken: githubToken ?? null,
  });
}

/** Clear backend marketplace caches. */
export function MarketplaceClearCache(): Promise<string> {
  return call('marketplace_clear_cache');
}

/** Start GitHub device-flow authentication. */
export function MarketplaceGithubDeviceStart(
  clientId: string,
  scopes: string[] = [],
): Promise<backend.GithubDeviceFlowChallenge> {
  return call('marketplace_github_device_start', {
    clientId,
    scopes,
  });
}

/** Poll GitHub device-flow authentication. */
export function MarketplaceGithubDevicePoll(
  clientId: string,
  deviceCode: string,
): Promise<backend.GithubDeviceFlowPollResult> {
  return call('marketplace_github_device_poll', {
    clientId,
    deviceCode,
  });
}

/** Download an APK from a URL to a temp directory. Returns the local file path. */
export function MarketplaceDownloadApk(url: string): Promise<string> {
  return call('marketplace_download_apk', { url });
}

/** Install a downloaded APK via ADB on the selected device when serial is set. */
export function MarketplaceInstallApk(apkPath: string, serial?: string | null): Promise<string> {
  return call('marketplace_install_apk', { apkPath, serial });
}

// ── Debloater ────────────────────────────────────────────────────────────────

/** Load UAD lists from remote/cache/bundled. Returns status info. */
export function LoadDebloatLists(): Promise<backend.DebloatListStatus> {
  return call('load_debloat_lists');
}

/** Get all system packages merged with UAD metadata. */
export function GetDebloatPackages(serial?: string | null): Promise<backend.DebloatPackageRow[]> {
  return call('get_debloat_packages', { serial: serial ?? null });
}

/** Apply an action to a batch of packages. action: 'uninstall' | 'disable' | 'restore'. */
export function DebloatPackages(
  packages: string[],
  action: backend.DebloatAction,
  user = 0,
  serial?: string | null,
): Promise<backend.DebloatActionResult[]> {
  return call('debloat_packages', { packages, action, user, serial: serial ?? null });
}

/** Create a backup snapshot of current package states. */
export function CreateDebloatBackup(
  packages: backend.PackageSnapshot[],
  serial?: string | null,
): Promise<backend.BackupSummary> {
  return call('create_debloat_backup', { packages, serial: serial ?? null });
}

/** List all available backups for the selected device. */
export function ListDebloatBackups(serial?: string | null): Promise<backend.BackupSummary[]> {
  return call('list_debloat_backups', { serial: serial ?? null });
}

/**
 * Restore a previously created backup by file name, reapplying each package's recorded
 * state. `fileName` comes from {@link backend.BackupSummary.fileName}.
 */
export function RestoreDebloatBackup(
  fileName: string,
  serial?: string | null,
): Promise<backend.DebloatActionResult[]> {
  return call('restore_debloat_backup', { fileName, serial: serial ?? null });
}

/** Get per-device settings (expert mode, disable mode, multi-user mode). */
export function GetDebloatDeviceSettings(
  serial?: string | null,
): Promise<backend.PerDeviceSettings> {
  return call('get_debloat_device_settings', { serial: serial ?? null });
}

/** Save per-device settings. */
export function SaveDebloatDeviceSettings(
  settings: backend.PerDeviceSettings,
  serial?: string | null,
): Promise<void> {
  return call('save_debloat_device_settings', { settings, serial: serial ?? null });
}

/** Combined response for all initial debloater data. */
export type DebloatData = backend.DebloatData;

/** Get all debloater data in one call. Uses in-memory cache when available. */
export function GetDebloatData(serial?: string | null): Promise<backend.DebloatData> {
  return call('get_debloat_data', { serial: serial ?? null });
}

/** Force refresh debloater data for the selected device. */
export function RefreshDebloatData(serial?: string | null): Promise<backend.DebloatData> {
  return call('refresh_debloat_data', { serial: serial ?? null });
}

export function GetAppIcons(
  packages: string[],
  serial?: string | null,
): Promise<backend.AppIcon[]> {
  return call('get_app_icons', { packages, serial: serial ?? null });
}

export function OpenDeviceFileInEditor(
  remotePath: string,
  serial?: string | null,
  accessMode: backend.FileAccessMode = DEFAULT_FILE_ACCESS_MODE,
  target: backend.DeviceEditorTarget = 'default',
): Promise<string> {
  return call('open_device_file_in_editor', { remotePath, serial, accessMode, target });
}

export function RevealDevicePathInExplorer(
  remotePath: string,
  serial?: string | null,
): Promise<string> {
  return call('reveal_device_path_in_explorer', { remotePath, serial: serial ?? null });
}

export function GetLogcatSnapshot(serial?: string | null, lines?: number): Promise<string> {
  return call('get_logcat_snapshot', { serial: serial ?? null, lines: lines ?? null });
}

export function ScrcpyStatus(): Promise<backend.ScrcpyStatus> {
  return call('scrcpy_status');
}

export function ScrcpyCheckUpdate(): Promise<backend.ScrcpyStatus> {
  return call('scrcpy_check_update');
}

export function ScrcpyInstall(): Promise<backend.ScrcpyStatus> {
  return call('scrcpy_install');
}

export function ScrcpyUninstall(): Promise<backend.ScrcpyStatus> {
  return call('scrcpy_uninstall');
}
export function ScrcpyLaunch(
  options: backend.ScrcpyLaunchOptions,
  serial?: string | null,
): Promise<void> {
  return call('scrcpy_launch', { options, serial: serial ?? null });
}
export function ScrcpyStop(serial?: string | null): Promise<void> {
  return call('scrcpy_stop', { serial: serial ?? null });
}

export function ScrcpyActiveSessions(): Promise<backend.ScrcpyActiveSessions> {
  return call('scrcpy_active_sessions');
}

export function ScrcpyPresets(): Promise<backend.ScrcpyPresetsCatalog> {
  return call('scrcpy_presets');
}

export function ScrcpyOpenToolbar(
  serial: string,
  pid?: number | null,
  mode?: backend.ToolbarMode,
  side?: backend.ToolbarSide,
): Promise<void> {
  return call('scrcpy_open_toolbar', {
    mode: mode ?? null,
    pid: pid ?? null,
    serial,
    side: side ?? null,
  });
}

export function ScrcpyCloseToolbar(serial: string): Promise<void> {
  return call('scrcpy_close_toolbar', { serial });
}

export function ScrcpyGetToolbarState(serial: string): Promise<backend.ToolbarSession | null> {
  return call('scrcpy_get_toolbar_state', { serial });
}

export function ScrcpySetToolbarMode(serial: string, mode: backend.ToolbarMode): Promise<void> {
  return call('scrcpy_set_toolbar_mode', { mode, serial });
}

export function ScrcpySetToolbarOffset(serial: string, offset: number): Promise<void> {
  return call('scrcpy_set_toolbar_offset', { offset, serial });
}

export function ScrcpySetToolbarSide(serial: string, side: backend.ToolbarSide): Promise<void> {
  return call('scrcpy_set_toolbar_side', { serial, side });
}

export function ScrcpySetToolbarSize(serial: string, width: number, height: number): Promise<void> {
  return call('scrcpy_set_toolbar_size', { height, serial, width });
}

export function ScrcpySendKeyevent(serial: string, keycode: number): Promise<void> {
  return call('scrcpy_send_keyevent', { keycode, serial });
}

export function ScrcpySendStatusbar(
  serial: string,
  action: 'expand-notifications' | 'expand-settings' | 'collapse',
): Promise<void> {
  return call('scrcpy_send_statusbar', { action, serial });
}

export function ScrcpyRotateDevice(
  serial: string,
  direction: 'clockwise' | 'counter-clockwise' | 'natural',
): Promise<void> {
  return call('scrcpy_rotate_device', { direction, serial });
}

export function ScrcpyTakeScreenshot(serial: string): Promise<string> {
  return call('scrcpy_take_screenshot', { serial });
}

// --- App Manager & Debloater Backend APIs ---
export function GetAppOverviewTelemetry(
  serial?: string | null,
): Promise<backend.AppOverviewTelemetry> {
  return call('get_app_overview_telemetry', { serial: serial ?? null });
}

export function BatchInspectPackages(paths: string[]): Promise<backend.ApkInspectionResult[]> {
  return call('batch_inspect_package_files', { paths });
}

export function BatchInstallPackages(
  paths: string[],
  serial?: string | null,
  flags?: string[],
): Promise<backend.BatchInstallResult[]> {
  return call('batch_install_packages', {
    paths,
    serial: serial ?? null,
    flags: flags ?? [],
  });
}

// --- Flasher Backend APIs ---
export function GetFlasherVitals(serial?: string | null): Promise<backend.FlasherVitalsResult> {
  return call('get_flasher_vitals', { serial: serial ?? null });
}

export function InspectPartitionImage(filePath: string): Promise<backend.PartitionTargetInfo> {
  return call('inspect_partition_image', { filePath });
}

export function FlashPartitionBatch(
  items: backend.BatchFlashItem[],
  serial?: string | null,
): Promise<void> {
  return call('flash_partition_batch', { items, serial: serial ?? null });
}

export function SideloadPackageStream(zipPath: string, serial?: string | null): Promise<void> {
  return call('sideload_package_stream', { zipPath, serial: serial ?? null });
}

export function ErasePartition(
  partition: string,
  confirmPhrase: string,
  serial?: string | null,
): Promise<void> {
  return call('erase_partition', { partition, confirmPhrase, serial: serial ?? null });
}

// --- Scrcpy & Emulator Backend APIs ---
export function ScrcpyPreviewCommand(
  options: backend.ScrcpyLaunchOptions,
  serial?: string | null,
): Promise<backend.ScrcpyCommandPreview> {
  return call('scrcpy_preview_command', { options, serial: serial ?? null });
}

export function ScrcpyProfiles(): Promise<backend.ScrcpyQualityProfile[]> {
  return call('scrcpy_profiles');
}

export function ScrcpyCalculateBandwidthMetrics(
  bitrate?: string | null,
): Promise<backend.BandwidthMetrics> {
  return call('scrcpy_calculate_bandwidth_metrics', { bitrate: bitrate ?? null });
}

export function ScrcpyToolbarAction(serial: string, action: string): Promise<void> {
  return call('scrcpy_toolbar_action', { serial, action });
}

export function EmulatorGetAvdSpecs(avdName: string): Promise<backend.AvdHardwareDetails> {
  return call('emulator_get_avd_specs', { avdName });
}

export function EmulatorGetDiskBreakdown(avdName: string): Promise<backend.AvdDiskBreakdown> {
  return call('emulator_get_disk_breakdown', { avdName });
}

export function GetHostHardwareCapacity(): Promise<backend.HostHardwareCapacity> {
  return call('system_host_resources');
}

// --- Marketplace, Payload, System & Device Backend APIs ---
export function MarketplaceCheckUpdates(
  serial?: string | null,
): Promise<backend.AppUpdateCandidate[]> {
  return call('marketplace_check_updates', { serial: serial ?? null });
}

export function MarketplaceGetOverviewStats(): Promise<backend.MarketplaceOverviewStats> {
  return call('marketplace_get_overview_stats');
}

export function MarketplaceGetCuratedTools(): Promise<backend.MarketplaceApp[]> {
  return call('marketplace_get_curated_tools');
}

export function ComputePartitionFileSha256(filePath: string): Promise<string> {
  return call('compute_partition_file_sha256', { filePath });
}

export function GetExtractionPresets(): Promise<backend.PayloadExtractionPreset[]> {
  return call('get_extraction_presets');
}

export function GetAllDevices(): Promise<backend.DeviceEntry[]> {
  return call('get_all_devices');
}

export function ExecuteCliCommand(
  command: string,
  serial?: string | null,
): Promise<backend.CliExecutionResult> {
  return call('execute_cli_command', { command, serial: serial ?? null });
}
