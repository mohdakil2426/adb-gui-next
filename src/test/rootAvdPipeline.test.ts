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
});
