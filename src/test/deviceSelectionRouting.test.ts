import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
  DeleteFiles,
  EnableWirelessAdb,
  FlashPartition,
  GetDeviceInfo,
  GetInstalledPackages,
  InstallPackage,
  ListFiles,
  PullFile,
  PushFile,
  Reboot,
  RenameFile,
  RunShellCommand,
  SideloadPackage,
  UninstallPackage,
  WipeData,
} from '@/lib/desktop/backend';

const invokeMock = vi.mocked(invoke);

describe('selected device routing', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('passes selected serials through device-specific backend wrappers', async () => {
    invokeMock.mockResolvedValue(undefined);

    await GetDeviceInfo('device-b');
    await EnableWirelessAdb('5555', 'device-b');
    await RunShellCommand('id', 'device-b');
    await GetInstalledPackages('device-b');
    await InstallPackage('C:/app.apk', 'device-b');
    await UninstallPackage('com.example.app', 'device-b');
    await ListFiles('/sdcard/', 'device-b');
    await PullFile('/sdcard/a.txt', 'C:/out', 'device-b');
    await PushFile('C:/in.txt', '/sdcard/in.txt', 'device-b');
    await DeleteFiles(['/sdcard/old.txt'], 'device-b');
    await RenameFile('/sdcard/a.txt', '/sdcard/b.txt', 'device-b');
    await SideloadPackage('C:/ota.zip', 'device-b');
    await Reboot('bootloader', 'device-b');
    await FlashPartition('boot', 'C:/boot.img', 'device-b');
    await WipeData('device-b');

    expect(invokeMock).toHaveBeenCalledWith('get_device_info', { serial: 'device-b' });
    expect(invokeMock).toHaveBeenCalledWith('enable_wireless_adb', {
      port: '5555',
      serial: 'device-b',
    });
    expect(invokeMock).toHaveBeenCalledWith('run_shell_command', {
      command: 'id',
      serial: 'device-b',
    });
    expect(invokeMock).toHaveBeenCalledWith('get_installed_packages', { serial: 'device-b' });
    expect(invokeMock).toHaveBeenCalledWith('install_package', {
      path: 'C:/app.apk',
      serial: 'device-b',
    });
    expect(invokeMock).toHaveBeenCalledWith('uninstall_package', {
      packageName: 'com.example.app',
      serial: 'device-b',
    });
    expect(invokeMock).toHaveBeenCalledWith('list_files', { path: '/sdcard/', serial: 'device-b' });
    expect(invokeMock).toHaveBeenCalledWith('pull_file', {
      remotePath: '/sdcard/a.txt',
      localPath: 'C:/out',
      serial: 'device-b',
    });
    expect(invokeMock).toHaveBeenCalledWith('push_file', {
      localPath: 'C:/in.txt',
      remotePath: '/sdcard/in.txt',
      serial: 'device-b',
    });
    expect(invokeMock).toHaveBeenCalledWith('delete_files', {
      paths: ['/sdcard/old.txt'],
      serial: 'device-b',
    });
    expect(invokeMock).toHaveBeenCalledWith('rename_file', {
      oldPath: '/sdcard/a.txt',
      newPath: '/sdcard/b.txt',
      serial: 'device-b',
    });
    expect(invokeMock).toHaveBeenCalledWith('sideload_package', {
      path: 'C:/ota.zip',
      serial: 'device-b',
    });
    expect(invokeMock).toHaveBeenCalledWith('reboot', {
      mode: 'bootloader',
      serial: 'device-b',
    });
    expect(invokeMock).toHaveBeenCalledWith('flash_partition', {
      partition: 'boot',
      imagePath: 'C:/boot.img',
      serial: 'device-b',
    });
    expect(invokeMock).toHaveBeenCalledWith('wipe_data', { serial: 'device-b' });
  });

  it('keeps the header device popover inside the content area instead of overlapping the sidebar', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/DeviceSwitcher.tsx'), 'utf8');

    expect(source).toContain('<PopoverContent align="start"');
    expect(source).toContain('collisionPadding={16}');
  });
});
