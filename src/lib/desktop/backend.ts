import { open, save } from "@tauri-apps/plugin-dialog";
import * as core from "@tauri-apps/api/core";
import { backend } from "./models";

const invoke = core.invoke as <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

function call<T>(command: string, args?: Record<string, unknown>) {
  return invoke<T>(command, args);
}

function normalizeSingleSelection(selection: string | null): string {
  return selection ?? "";
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
  return call("cleanup_payload_cache");
}

export function ConnectWirelessAdb(arg1: string, arg2: string): Promise<string> {
  return call("connect_wireless_adb", { ip: arg1, port: arg2 });
}

export function DisconnectWirelessAdb(arg1: string, arg2: string): Promise<string> {
  return call("disconnect_wireless_adb", { ip: arg1, port: arg2 });
}

export function EnableWirelessAdb(arg1: string): Promise<string> {
  return call("enable_wireless_adb", { port: arg1 });
}

export function ExtractPayload(
  arg1: string,
  arg2: string,
  arg3: Array<string>,
): Promise<backend.ExtractPayloadResult> {
  return call("extract_payload", {
    payloadPath: arg1,
    outputDir: arg2,
    selectedPartitions: arg3,
  });
}

export function FlashPartition(arg1: string, arg2: string): Promise<void> {
  return call("flash_partition", { partition: arg1, imagePath: arg2 });
}

export function GetBootloaderVariables(): Promise<string> {
  return call("get_bootloader_variables");
}

export function GetDeviceInfo(): Promise<backend.DeviceInfo> {
  return call("get_device_info");
}

export function GetDeviceMode(): Promise<string> {
  return call("get_device_mode");
}

export function GetDevices(): Promise<Array<backend.Device>> {
  return call("get_devices");
}

export function GetFastbootDevices(): Promise<Array<backend.Device>> {
  return call("get_fastboot_devices");
}

export function GetInstalledPackages(): Promise<Array<backend.InstalledPackage>> {
  return call("get_installed_packages");
}

export function Greet(arg1: string): Promise<string> {
  return call("greet", { name: arg1 });
}

export function InstallPackage(arg1: string): Promise<string> {
  return call("install_package", { path: arg1 });
}

export function LaunchDeviceManager(): Promise<void> {
  return call("launch_device_manager");
}

export function LaunchTerminal(): Promise<void> {
  return call("launch_terminal");
}

export function ListFiles(arg1: string): Promise<Array<backend.FileEntry>> {
  return call("list_files", { path: arg1 });
}

export function ListPayloadPartitions(arg1: string): Promise<Array<string>> {
  return call("list_payload_partitions", { payloadPath: arg1 });
}

export function ListPayloadPartitionsWithDetails(arg1: string): Promise<Array<backend.PartitionDetail>> {
  return call("list_payload_partitions_with_details", { payloadPath: arg1 });
}

export function OpenFolder(arg1: string): Promise<void> {
  return call("open_folder", { folderPath: arg1 });
}

export function PullFile(arg1: string, arg2: string): Promise<string> {
  return call("pull_file", { remotePath: arg1, localPath: arg2 });
}

export function PushFile(arg1: string, arg2: string): Promise<string> {
  return call("push_file", { localPath: arg1, remotePath: arg2 });
}

export function Reboot(arg1: string): Promise<void> {
  return call("reboot", { mode: arg1 });
}

export function RunAdbHostCommand(arg1: string): Promise<string> {
  return call("run_adb_host_command", { command: arg1 });
}

export function RunFastbootHostCommand(arg1: string): Promise<string> {
  return call("run_fastboot_host_command", { command: arg1 });
}

export function RunShellCommand(arg1: string): Promise<string> {
  return call("run_shell_command", { command: arg1 });
}

export function SaveLog(arg1: string, arg2: string): Promise<string> {
  return call("save_log", { content: arg1, prefix: arg2 });
}

export function SelectApkFile(): Promise<string> {
  return selectFile({
    filters: [
      {
        name: "APK files",
        extensions: ["apk", "apks"],
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
        name: "Image files",
        extensions: ["img"],
      },
    ],
  });
}

export function SelectMultipleApkFiles(): Promise<Array<string>> {
  return selectFiles({
    multiple: true,
    filters: [
      {
        name: "APK files",
        extensions: ["apk", "apks"],
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
        name: "Payload files",
        extensions: ["bin", "zip"],
      },
    ],
  });
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
        name: "ZIP files",
        extensions: ["zip"],
      },
    ],
  });
}

export function SetActiveSlot(arg1: string): Promise<void> {
  return call("set_active_slot", { slot: arg1 });
}

export function SideloadPackage(arg1: string): Promise<string> {
  return call("sideload_package", { path: arg1 });
}

export function UninstallPackage(arg1: string): Promise<string> {
  return call("uninstall_package", { packageName: arg1 });
}

export function WipeData(): Promise<void> {
  return call("wipe_data");
}
