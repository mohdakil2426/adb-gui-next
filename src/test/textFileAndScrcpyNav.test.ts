import { describe, expect, it } from 'vitest';
import { VIEWS } from '@/app/shell/viewConfig';
import { isTextDeviceFile } from '@/features/file-explorer/utils/textFileExtensions';
import { NAV_SECTIONS, VIEW_META } from '@/shared/commands/navigation';

describe('text device files', () => {
  it('allows known text extensions', () => {
    expect(isTextDeviceFile('init.rc')).toBe(true);
    expect(isTextDeviceFile('build.prop')).toBe(true);
    expect(isTextDeviceFile('notes.md')).toBe(true);
  });

  it('rejects archives and images', () => {
    expect(isTextDeviceFile('boot.img')).toBe(false);
    expect(isTextDeviceFile('archive.zip')).toBe(false);
    expect(isTextDeviceFile('noext')).toBe(false);
  });
});

describe('scrcpy navigation', () => {
  it('registers Scrcpy in Tools and VIEW_META', () => {
    expect(VIEW_META[VIEWS.SCRCPY].title).toBe('Scrcpy');
    const tools = NAV_SECTIONS.find((section) => section.label === 'Tools');
    expect(tools?.items).toContain(VIEWS.SCRCPY);
  });
});
