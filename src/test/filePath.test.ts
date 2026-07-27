import { describe, expect, it } from 'vitest';
import { getFileName } from '@/shared/utils/filePath';

describe('getFileName', () => {
  it('extracts the filename from a device (POSIX) path', () => {
    expect(getFileName('/sdcard/Download/app.apk')).toBe('app.apk');
    expect(getFileName('/very/long/nested/path/file.txt')).toBe('file.txt');
  });

  it('extracts the filename from a host (Windows) path', () => {
    expect(getFileName('C:\\Users\\test\\app.apk')).toBe('app.apk');
  });

  it('returns the input when it holds no separator', () => {
    expect(getFileName('app.apk')).toBe('app.apk');
    expect(getFileName(' ')).toBe(' ');
  });

  it('returns an empty string for empty input', () => {
    expect(getFileName('')).toBe('');
  });
});
