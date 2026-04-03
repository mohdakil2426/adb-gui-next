import { open, save } from '@tauri-apps/plugin-dialog';
import * as core from '@tauri-apps/api/core';
import type { backend } from './models';

const invoke = core.invoke as <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

function call<T>(command: string, args?: Record<string, unknown>) {
  return invoke<T>(command, args);
}

function normalizeSingleSelection(selection: string | null): string {
  return selection ?? '';
}

function normalizeMultipleSelection(selection: string | string[] | null): Array<string> {
  if (Array.isArray(selection)) {
    return selection;
  }

  return selection ? [selection] : [];
}

async function selectFile(options: Parameters<typeof open>[0]): Promise<string> {
  return normalizeSingleSelection(await open(options));
}

async function selectFiles(options: Parameters<typeof open>[0]): Promise<Array<string>> {
  return normalizeMultipleSelection(await open(options));
}

async function selectSavePath(options: Parameters<typeof save>[0]): Promise<string> {
  return normalizeSingleSelection(await save(options));
}

export function CleanupPayloadCache(): Promise<void> {
  return call('cleanup_payload_cache');
}

export function ConnectWirelessAdb(arg1: string, arg2: string): Promise<string> {
  return call('connect_wireless_adb', { ip: arg1, port: arg2 });
}

export function DisconnectWirelessAdb(arg1: string, arg2: string): Promise<string> {
  return call('disconnect_wireless_adb', { ip: arg1, port: arg2 });
}

export function EnableWirelessAdb(arg1: string): Promise<string> {
  return call('enable_wireless_adb', { port: arg1 });
}

export function ExtractPayload(
  arg1: string,
  arg2: string,
  arg3: Array<string>,
  prefetch?: boolean,
): Promise<backend.ExtractPayloadResult> {
  return call('extract_payload', {
    payloadPath: arg1,
    outputDir: arg2,
    selectedPartitions: arg3,
    prefetch: prefetch ?? null,
  });
}

export function FlashPartition(arg1: string, arg2: string): Promise<void> {
  return call('flash_partition', { partition: arg1, imagePath: arg2 });
}

export function GetBootloaderVariables(): Promise<string> {
  return call('get_bootloader_variables');
}

export function GetDeviceInfo(): Promise<backend.DeviceInfo> {
  return call('get_device_info');
}

export function GetDeviceMode(): Promise<string> {
  return call('get_device_mode');
}

export function GetDevices(): Promise<Array<backend.Device>> {
  return call('get_devices');
}

export function GetFastbootDevices(): Promise<Array<backend.Device>> {
  return call('get_fastboot_devices');
}

export function GetInstalledPackages(): Promise<Array<backend.InstalledPackage>> {
  return call('get_installed_packages');
}

export function InstallPackage(arg1: string): Promise<string> {
  return call('install_package', { path: arg1 });
}

export function LaunchDeviceManager(): Promise<void> {
  return call('launch_device_manager');
}

export function LaunchTerminal(): Promise<void> {
  return call('launch_terminal');
}

export function ListFiles(arg1: string): Promise<Array<backend.FileEntry>> {
  return call('list_files', { path: arg1 });
}

export function ListPayloadPartitions(arg1: string): Promise<Array<string>> {
  return call('list_payload_partitions', { payloadPath: arg1 });
}

export function ListPayloadPartitionsWithDetails(
  arg1: string,
): Promise<Array<backend.PartitionDetail>> {
  return call('list_payload_partitions_with_details', { payloadPath: arg1 });
}

export function OpenFolder(arg1: string): Promise<void> {
  return call('open_folder', { folderPath: arg1 });
}

export function PullFile(arg1: string, arg2: string): Promise<string> {
  return call('pull_file', { remotePath: arg1, localPath: arg2 });
}

export function PushFile(arg1: string, arg2: string): Promise<string> {
  return call('push_file', { localPath: arg1, remotePath: arg2 });
}

export function CreateDirectory(arg1: string): Promise<string> {
  return call('create_directory', { path: arg1 });
}

export function CreateFile(arg1: string): Promise<string> {
  return call('create_file', { path: arg1 });
}

export function DeleteFiles(arg1: string[]): Promise<string> {
  return call('delete_files', { paths: arg1 });
}

export function RenameFile(arg1: string, arg2: string): Promise<string> {
  return call('rename_file', { oldPath: arg1, newPath: arg2 });
}

export function Reboot(arg1: string): Promise<void> {
  return call('reboot', { mode: arg1 });
}

export function RunAdbHostCommand(arg1: string): Promise<string> {
  return call('run_adb_host_command', { command: arg1 });
}

export function RunFastbootHostCommand(arg1: string): Promise<string> {
  return call('run_fastboot_host_command', { command: arg1 });
}

export function RunShellCommand(arg1: string): Promise<string> {
  return call('run_shell_command', { command: arg1 });
}

export function SaveLog(arg1: string, arg2: string): Promise<string> {
  return call('save_log', { content: arg1, prefix: arg2 });
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

export function SelectMultipleApkFiles(): Promise<Array<string>> {
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

export function SelectSaveDirectory(arg1: string): Promise<string> {
  return selectSavePath({
    defaultPath: arg1,
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

export function SetActiveSlot(arg1: string): Promise<void> {
  return call('set_active_slot', { slot: arg1 });
}

export function SideloadPackage(arg1: string): Promise<string> {
  return call('sideload_package', { path: arg1 });
}

export function UninstallPackage(arg1: string): Promise<string> {
  return call('uninstall_package', { packageName: arg1 });
}

export function WipeData(): Promise<void> {
  return call('wipe_data');
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
export function ListRemotePayloadPartitions(url: string): Promise<Array<backend.PartitionDetail>> {
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

/** Search apps across all marketplace providers (F-Droid, IzzyOnDroid, GitHub, Aptoide). */
export function MarketplaceSearch(
  query: string,
  filters?: backend.MarketplaceSearchFilters,
): Promise<Array<backend.MarketplaceApp>> {
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
): Promise<Array<backend.MarketplaceApp>> {
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
): Promise<Array<backend.VersionInfo>> {
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
