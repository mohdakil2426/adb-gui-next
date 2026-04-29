/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const rootPipelineFile = join(process.cwd(), 'src-tauri', 'src', 'emulator', 'root.rs');
const magiskDownloadFile = join(
  process.cwd(),
  'src-tauri',
  'src',
  'emulator',
  'magisk_download.rs',
);

describe('rootAVD-aligned ramdisk patch pipeline', () => {
  it('creates ramdisk.cpio.orig before magiskboot backup uses it', () => {
    const source = readFileSync(rootPipelineFile, 'utf8');
    const createOrig = 'cp {ROOT_WORKDIR}/ramdisk.cpio {ROOT_WORKDIR}/ramdisk.cpio.orig';
    const useOrig = "'backup {ROOT_WORKDIR}/ramdisk.cpio.orig'";

    expect(source).toContain(createOrig);
    expect(source.indexOf(createOrig)).toBeLessThan(source.indexOf(useOrig));
  });

  it('treats a missing checked-shell exit marker as a pipeline failure', () => {
    const source = readFileSync(rootPipelineFile, 'utf8');

    expect(source).toContain('Missing ADB shell exit marker');
    expect(source).toContain('parse_exit_code(&output, EXIT_CODE_MARKER)');
  });

  it('returns patch-installed status instead of verified-root status from root_avd', () => {
    const source = readFileSync(rootPipelineFile, 'utf8');

    expect(source).toContain('activation_status: RootActivationStatus::PatchInstalled');
    expect(source).toContain('Cold boot the emulator, then run verification');
  });

  it('installs Magisk Manager before sending the emulator shutdown signal', () => {
    const source = readFileSync(rootPipelineFile, 'utf8');
    const install = source.indexOf('Step 7 - installing Magisk Manager APK before shutdown');
    const shutdown = source.indexOf('setprop sys.powerctl shutdown');

    expect(install).toBeGreaterThan(-1);
    expect(shutdown).toBeGreaterThan(-1);
    expect(install).toBeLessThan(shutdown);
  });

  it('does not reject API 30 plus multi-cpio ramdisks before magiskboot validation', () => {
    const source = readFileSync(rootPipelineFile, 'utf8');

    expect(source).toContain('TRAILER!!!');
    expect(source).not.toContain('Automated patching is not yet safe');
    expect(source).not.toContain('add the rootAVD repack path before proceeding');
  });

  it('rebuilds API 30 plus multi-cpio ramdisks before Magisk patching', () => {
    const source = readFileSync(rootPipelineFile, 'utf8');
    const repackCall = 'repack_multi_cpio_ramdisk_if_needed(app, serial)?';
    const magiskbootTest = 'cpio {ROOT_WORKDIR}/ramdisk.cpio test';
    const patchCommand = "'patch'";

    expect(source).toContain('fn repack_multi_cpio_ramdisk_if_needed');
    expect(source).toContain('Multiple CPIO archives detected');
    expect(source).toContain('busybox cpio');
    expect(source).toContain('find . | ../busybox cpio -H newc -o > ../ramdisk.cpio.repacked');
    expect(source.indexOf(repackCall)).toBeLessThan(source.indexOf(magiskbootTest));
    expect(source.indexOf(repackCall)).toBeLessThan(source.indexOf(patchCommand));
  });

  it('pins automatic Magisk downloads to the rootAVD-compatible release', () => {
    const source = readFileSync(magiskDownloadFile, 'utf8');

    expect(source).toContain('MAGISK_AVD_RECOMMENDED_TAG: &str = "v25.2"');
    expect(source).toContain('local_rootavd_magisk_zip');
    expect(source).toContain('Magisk-rootAVD-v25.2.zip');
  });

  it('does not spam getprop while the emulator serial is still offline', () => {
    const source = readFileSync(rootPipelineFile, 'utf8');
    const onlineCheck = 'runtime::is_serial_online(app, serial)';
    const bootProp = 'getprop(app, serial, "sys.boot_completed")';

    expect(source).toContain('ADB still offline during boot');
    expect(source.indexOf(onlineCheck)).toBeLessThan(source.indexOf(bootProp));
  });

  it('clears stale Magisk patched outputs before preparing a new fakeboot image', () => {
    const source = readFileSync(rootPipelineFile, 'utf8');
    const cleanup = 'clear_stale_manual_patch_outputs(app, &request.serial)?';
    const pushFakeBoot =
      '&["-s", &request.serial, "push", &local_fake_boot_string, FAKE_BOOT_REMOTE_PATH]';

    expect(source).toContain('fn clear_stale_manual_patch_outputs');
    expect(source).toContain(cleanup);
    expect(source.indexOf(cleanup)).toBeLessThan(source.indexOf(pushFakeBoot));
  });

  it('does not use a shell for-loop when finding manual Magisk patched output', () => {
    const source = readFileSync(rootPipelineFile, 'utf8');

    expect(source).not.toContain('for dir in /sdcard/Download');
    expect(source).not.toContain('; do ls -t');
    expect(source).toContain(
      'ls -t /sdcard/Download/*magisk_patched* /storage/emulated/0/Download/*magisk_patched*',
    );
  });

  it('supports finalizing manual root from a local patched image path', () => {
    const source = readFileSync(rootPipelineFile, 'utf8');

    expect(source).toContain('patched_image_path');
    expect(source).toContain('PathBuf::from(patched_image_path)');
    expect(source).toContain(
      'No patched image was selected and the emulator serial is unavailable',
    );
  });
});
