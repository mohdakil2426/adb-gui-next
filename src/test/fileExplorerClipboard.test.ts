import { describe, expect, it } from 'vitest';
import {
  canPasteHere,
  PASTE_TOAST,
  plannedDestinations,
} from '@/features/file-explorer/utils/fileExplorerClipboard';
import { destinationPath, joinRemoteDir } from '@/features/file-explorer/utils/fileExplorerPaths';

describe('joinRemoteDir', () => {
  it('joins under root and under a trailing-slash folder', () => {
    expect(joinRemoteDir('/', 'hosts')).toBe('/hosts');
    expect(joinRemoteDir('/sdcard/', 'Download')).toBe('/sdcard/Download');
    expect(joinRemoteDir('/sdcard/Download', 'a.txt')).toBe('/sdcard/Download/a.txt');
  });
});

describe('destinationPath', () => {
  it('keeps the source basename', () => {
    expect(destinationPath('/sdcard/Music/', '/sdcard/DCIM/a.mp3')).toBe('/sdcard/Music/a.mp3');
  });
});

describe('canPasteHere', () => {
  const clip = {
    mode: 'copy' as const,
    serial: 'device-a',
    sources: ['/sdcard/DCIM/a.mp3'],
  };

  it('blocks empty, other serial, and same-folder copy or cut', () => {
    expect(canPasteHere(null, '/sdcard/Music/', 'device-a')).toBe('empty');
    expect(canPasteHere(clip, '/sdcard/Music/', 'device-b')).toBe('wrong-device');
    expect(canPasteHere(clip, '/sdcard/Music/', null)).toBe('wrong-device');
    expect(canPasteHere(clip, '/sdcard/DCIM/', 'device-a')).toBe('same-folder-copy');
    expect(canPasteHere({ ...clip, mode: 'cut' }, '/sdcard/DCIM/', 'device-a')).toBe(
      'same-folder-cut',
    );
    expect(canPasteHere(clip, '/sdcard/Music/', 'device-a')).toBe('ok');
  });
});

describe('plannedDestinations', () => {
  it('maps each source into the destination folder', () => {
    expect(
      plannedDestinations(
        { mode: 'copy', serial: 'device-a', sources: ['/sdcard/DCIM/a.mp3'] },
        '/sdcard/Music/',
      ),
    ).toEqual(['/sdcard/Music/a.mp3']);
  });
});

describe('PASTE_TOAST', () => {
  it('covers every blocked paste reason', () => {
    expect(PASTE_TOAST.empty).toBe('Nothing to paste');
    expect(PASTE_TOAST['wrong-device']).toBe('Clipboard is from another device');
    expect(PASTE_TOAST['same-folder-cut']).toBe('Cannot move items into the same folder');
    expect(PASTE_TOAST['same-folder-copy']).toBe('Items are already in this folder');
  });
});
