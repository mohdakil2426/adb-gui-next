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

export function DiagnosePayload(path: string): Promise<backend.PayloadDiagnostics> {
  return call('diagnose_payload', { path });
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

export function ExtractDeltaPayload(
  payloadPath: string,
  sourceDir: string,
  outputDir: string,
  selectedPartitions: string[],
  cancelTokenId?: string,
): Promise<backend.ExtractPayloadResult> {
  return call('extract_delta_payload', {
    payloadPath,
    sourceDir,
    outputDir,
    selectedPartitions,
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

export function GetBootloaderVariables(): Promise<string> {
  return call('get_bootloader_variables');
}

export function GetAvdRestorePlan(avdName: string): Promise<backend.RestorePlan> {
  return call('get_avd_restore_plan', { avdName });
}

export function GetDeviceInfo(serial?: string | null): Promise<backend.DeviceInfo> {
  return call('get_device_info', { serial });
}

export function GetDeviceMode(): Promise<string> {
  return call('get_device_mode');
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

export function InstallPackage(path: string, serial?: string | null): Promise<string> {
  return call('install_package', { path, serial });
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

export function ListPayloadPartitions(payloadPath: string): Promise<string[]> {
  return call('list_payload_partitions', { payloadPath });
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

export function SelectApkFile(): Promise<string> {
  return selectFile({
    filters: [
      {
        name: 'APK files',
        extensions: ['apk', 'apks'],
      },
    ],
  });
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
        name: 'APK files',
        extensions: ['apk', 'apks'],
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

export function GetOpsMetadata(path: string): Promise<backend.OpsMetadata> {
  return call('get_ops_metadata', { path });
}

export function SelectSaveDirectory(defaultPath: string): Promise<string> {
  return selectSavePath({
    defaultPath,
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

export function SetActiveSlot(slot: string): Promise<void> {
  return call('set_active_slot', { slot });
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

export function WipeData(serial?: string | null): Promise<void> {
  return call('wipe_data', { serial });
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

/** Fetch trending/popular Android apps from GitHub. */
export function MarketplaceGetTrending(
  sort?: string,
  githubToken?: string | null,
  limit?: number,
): Promise<backend.MarketplaceApp[]> {
  return call('marketplace_get_trending', {
    sort: sort ?? null,
    githubToken: githubToken ?? null,
    limit: limit ?? null,
  });
}

/** List version history for a specific app. */
export function MarketplaceListVersions(
  packageName: string,
  source: string,
  githubToken?: string | null,
): Promise<backend.VersionInfo[]> {
  return call('marketplace_list_versions', {
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

/** Install a downloaded APK via ADB. */
export function MarketplaceInstallApk(apkPath: string): Promise<string> {
  return call('marketplace_install_apk', { apkPath });
}

// ── Debloater ────────────────────────────────────────────────────────────────

/** Load UAD lists from remote/cache/bundled. Returns status info. */
export function LoadDebloatLists(): Promise<backend.DebloatListStatus> {
  return call('load_debloat_lists');
}

/** Get all system packages merged with UAD metadata. */
export function GetDebloatPackages(): Promise<backend.DebloatPackageRow[]> {
  return call('get_debloat_packages');
}

/** Apply an action to a batch of packages. action: 'uninstall' | 'disable' | 'restore'. */
export function DebloatPackages(
  packages: string[],
  action: backend.DebloatAction,
  user = 0,
): Promise<backend.DebloatActionResult[]> {
  return call('debloat_packages', { packages, action, user });
}

/** Create a backup snapshot of current package states. */
export function CreateDebloatBackup(
  packages: backend.PackageSnapshot[],
): Promise<backend.BackupSummary> {
  return call('create_debloat_backup', { packages });
}

/** List all available backups for the connected device. */
export function ListDebloatBackups(): Promise<backend.BackupSummary[]> {
  return call('list_debloat_backups');
}

/** Restore a previously created backup. */
export function RestoreDebloatBackup(fileName: string): Promise<backend.DebloatActionResult[]> {
  return call('restore_debloat_backup', { fileName });
}

/** Get per-device settings (expert mode, disable mode, multi-user mode). */
export function GetDebloatDeviceSettings(): Promise<backend.PerDeviceSettings> {
  return call('get_debloat_device_settings');
}

/** Save per-device settings. */
export function SaveDebloatDeviceSettings(settings: backend.PerDeviceSettings): Promise<void> {
  return call('save_debloat_device_settings', { settings });
}

/** Get the Android SDK version of the connected device. */
export function GetDeviceSdk(): Promise<number> {
  return call('get_device_sdk');
}

/** Combined response for all initial debloater data. */
export interface DebloatData {
  backups: backend.BackupSummary[];
  list_status: backend.DebloatListStatus;
  packages: backend.DebloatPackageRow[];
  settings: backend.PerDeviceSettings;
}

/** Get all debloater data in one call. Uses in-memory cache when available. */
export function GetDebloatData(): Promise<DebloatData> {
  return call('get_debloat_data');
}

/** Force refresh all debloater data (invalidates cache). */
export function RefreshDebloatData(): Promise<DebloatData> {
  return call('refresh_debloat_data');
}
