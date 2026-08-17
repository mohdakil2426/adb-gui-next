import { describe, expect, it } from 'vitest';
import {
  destDirFromDropTarget,
  parseInternalFileNames,
} from '@/features/file-explorer/utils/fileExplorerDrop';

describe('parseInternalFileNames', () => {
  it('returns names from the internal drag payload', () => {
    const dataTransfer = {
      getData: () => JSON.stringify(['a.txt', 'b']),
    } as unknown as DataTransfer;
    expect(parseInternalFileNames(dataTransfer)).toEqual(['a.txt', 'b']);
  });

  it('rejects malformed payloads', () => {
    const dataTransfer = {
      getData: () => '{',
    } as unknown as DataTransfer;
    expect(parseInternalFileNames(dataTransfer)).toBeNull();
  });
});

describe('destDirFromDropTarget', () => {
  it('prefers a folder target over the pane fallback', () => {
    const el = document.createElement('div');
    el.setAttribute('data-fe-drop-dir', '/sdcard/Download/');
    el.setAttribute('data-fe-drop-pane', '/sdcard/');
    expect(destDirFromDropTarget(el, '/fallback/')).toBe('/sdcard/Download/');
  });

  it('uses the pane path when no folder target is set', () => {
    const el = document.createElement('div');
    el.setAttribute('data-fe-drop-pane', '/sdcard/DCIM/');
    expect(destDirFromDropTarget(el, '/fallback/')).toBe('/sdcard/DCIM/');
  });
});
