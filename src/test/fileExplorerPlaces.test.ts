import { describe, expect, it } from 'vitest';
import { activePlaceId } from '@/features/file-explorer/model/fileExplorerPlaces';

describe('activePlaceId', () => {
  it('picks the longest matching pin', () => {
    expect(activePlaceId('/sdcard/')).toBe('internal');
    expect(activePlaceId('/sdcard/Download/foo')).toBe('download');
    expect(activePlaceId('/data/')).toBeNull();
  });
});
