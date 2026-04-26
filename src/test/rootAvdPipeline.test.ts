import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const rootPipelineFile = join(process.cwd(), 'src-tauri', 'src', 'emulator', 'root.rs');

describe('rootAVD-aligned ramdisk patch pipeline', () => {
  it('creates ramdisk.cpio.orig before magiskboot backup uses it', () => {
    const source = readFileSync(rootPipelineFile, 'utf8');
    const createOrig = 'cp {ROOT_WORKDIR}/ramdisk.cpio {ROOT_WORKDIR}/ramdisk.cpio.orig';
    const useOrig = "'backup {ROOT_WORKDIR}/ramdisk.cpio.orig'";

    expect(source).toContain(createOrig);
    expect(source.indexOf(createOrig)).toBeLessThan(source.indexOf(useOrig));
  });
});
