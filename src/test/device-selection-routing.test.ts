import { readFileSync } from "node:fs";
import { join } from "node:path";

import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DeleteFiles,
  EnableWirelessAdb,
  FlashPartition,
  GetDeviceInfo,
  GetInstalledPackages,
  InstallPackage,
  ListFiles,
  OpenDeviceFileInEditor,
  PullFile,
  PushFile,
  Reboot,
  RenameFile,
  RevealDevicePathInExplorer,
  RunShellCommand,
  SideloadPackage,
  TransferDeviceFiles,
  UninstallPackage,
  WipeData,
} from "@/desktop/backend";

const invokeMock = vi.mocked(invoke);

describe("selected device routing", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("routes device status and shell commands", async () => {
    invokeMock.mockResolvedValue();

    await GetDeviceInfo("device-b");
    await EnableWirelessAdb("5555", "device-b");
    await RunShellCommand("id", "device-b");

    expect(invokeMock).toHaveBeenCalledWith("get_device_info", {
      serial: "device-b",
    });
    expect(invokeMock).toHaveBeenCalledWith("enable_wireless_adb", {
      port: "5555",
      serial: "device-b",
    });
    expect(invokeMock).toHaveBeenCalledWith("run_shell_command", {
      command: "id",
      serial: "device-b",
    });
  });

  it("routes package management commands", async () => {
    invokeMock.mockResolvedValue();

    await GetInstalledPackages("device-b");
    await InstallPackage("C:/app.apk", "device-b");
    await UninstallPackage("com.example.app", "device-b");

    expect(invokeMock).toHaveBeenCalledWith("get_installed_packages", {
      serial: "device-b",
    });
    expect(invokeMock).toHaveBeenCalledWith("install_package", {
      path: "C:/app.apk",
      serial: "device-b",
    });
    expect(invokeMock).toHaveBeenCalledWith("uninstall_package", {
      packageName: "com.example.app",
      serial: "device-b",
    });
  });

  it("routes file browsing and transfer commands", async () => {
    invokeMock.mockResolvedValue();

    await ListFiles("/sdcard/", "device-b");
    await ListFiles("/system/", "device-b", "root");
    await PullFile("/sdcard/a.txt", "C:/out", "device-b");
    await PullFile("/system/build.prop", "C:/out", "device-b", "root");
    await PushFile("C:/in.txt", "/sdcard/in.txt", "device-b");

    expect(invokeMock).toHaveBeenCalledWith("list_files", {
      accessMode: "normal",
      path: "/sdcard/",
      serial: "device-b",
    });
    expect(invokeMock).toHaveBeenCalledWith("list_files", {
      accessMode: "root",
      path: "/system/",
      serial: "device-b",
    });
    expect(invokeMock).toHaveBeenCalledWith("pull_file", {
      accessMode: "normal",
      localPath: "C:/out",
      remotePath: "/sdcard/a.txt",
      serial: "device-b",
    });
    expect(invokeMock).toHaveBeenCalledWith("pull_file", {
      accessMode: "root",
      localPath: "C:/out",
      remotePath: "/system/build.prop",
      serial: "device-b",
    });
    expect(invokeMock).toHaveBeenCalledWith("push_file", {
      accessMode: "normal",
      localPath: "C:/in.txt",
      remotePath: "/sdcard/in.txt",
      serial: "device-b",
    });
  });

  it("routes file modification commands", async () => {
    invokeMock.mockResolvedValue();

    await PushFile("C:/hosts", "/system/etc/hosts", "device-b", "root");
    await DeleteFiles(["/sdcard/old.txt"], "device-b");
    await DeleteFiles(["/system/old"], "device-b", "root");
    await TransferDeviceFiles(
      "copy",
      ["/sdcard/a.txt"],
      "/sdcard/Download/",
      false,
      "device-b",
      "device-b"
    );
    await OpenDeviceFileInEditor("/sdcard/a.txt", "device-b", "normal", "vscode");

    expect(invokeMock).toHaveBeenCalledWith("push_file", {
      accessMode: "root",
      localPath: "C:/hosts",
      remotePath: "/system/etc/hosts",
      serial: "device-b",
    });
    expect(invokeMock).toHaveBeenCalledWith("delete_files", {
      accessMode: "normal",
      paths: ["/sdcard/old.txt"],
      serial: "device-b",
    });
    expect(invokeMock).toHaveBeenCalledWith("delete_files", {
      accessMode: "root",
      paths: ["/system/old"],
      serial: "device-b",
    });
    expect(invokeMock).toHaveBeenCalledWith("transfer_device_files", {
      accessMode: "normal",
      clipboardSerial: "device-b",
      destDir: "/sdcard/Download/",
      mode: "copy",
      overwrite: false,
      serial: "device-b",
      sources: ["/sdcard/a.txt"],
    });
    expect(invokeMock).toHaveBeenCalledWith("open_device_file_in_editor", {
      accessMode: "normal",
      remotePath: "/sdcard/a.txt",
      serial: "device-b",
      target: "vscode",
    });
  });

  it("routes explorer, rename, and recovery commands", async () => {
    invokeMock.mockResolvedValue();

    await RevealDevicePathInExplorer("/sdcard/Download/note.txt", "device-b");
    await RenameFile("/sdcard/a.txt", "/sdcard/b.txt", "device-b");
    await RenameFile("/system/a", "/system/b", "device-b", "root");
    await SideloadPackage("C:/ota.zip", "device-b");
    await Reboot("bootloader", "device-b");

    expect(invokeMock).toHaveBeenCalledWith("reveal_device_path_in_explorer", {
      remotePath: "/sdcard/Download/note.txt",
      serial: "device-b",
    });
    expect(invokeMock).toHaveBeenCalledWith("rename_file", {
      accessMode: "normal",
      newPath: "/sdcard/b.txt",
      oldPath: "/sdcard/a.txt",
      serial: "device-b",
    });
    expect(invokeMock).toHaveBeenCalledWith("rename_file", {
      accessMode: "root",
      newPath: "/system/b",
      oldPath: "/system/a",
      serial: "device-b",
    });
    expect(invokeMock).toHaveBeenCalledWith("sideload_package", {
      path: "C:/ota.zip",
      serial: "device-b",
    });
    expect(invokeMock).toHaveBeenCalledWith("reboot", {
      mode: "bootloader",
      serial: "device-b",
    });
  });

  it("routes flashing and wiping commands", async () => {
    invokeMock.mockResolvedValue();

    await FlashPartition("boot", "C:/boot.img", "device-b");
    await WipeData("device-b");

    expect(invokeMock).toHaveBeenCalledWith("flash_partition", {
      imagePath: "C:/boot.img",
      partition: "boot",
      serial: "device-b",
    });
    expect(invokeMock).toHaveBeenCalledWith("wipe_data", {
      confirm: null,
      serial: "device-b",
    });
  });

  it("keeps the header device popover inside the content area instead of overlapping the sidebar", () => {
    const source = readFileSync(
      join(process.cwd(), "src/shared/components/device-switcher.tsx"),
      "utf-8"
    );

    expect(source).toMatch(/<PopoverContent[\s\S]*?align="start"/u);
    expect(source).toContain("collisionPadding={16}");
  });
});
