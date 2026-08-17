import { describe, expect, it } from 'vitest';
import { activePlaceId } from '@/features/file-explorer/model/fileExplorerPlaces';

describe('activePlaceId', () => {
  it('picks the longest matching pin', () => {
    expect(activePlaceId('/sdcard/')).toBeNull();
    expect(activePlaceId('/sdcard/Download/foo')).toBe('download');
    expect(activePlaceId('/sdcard/DCIM/Camera')).toBe('dcim');
    expect(activePlaceId('/sdcard/Pictures/')).toBe('pictures');
    expect(activePlaceId('/data/')).toBeNull();
  });
});
