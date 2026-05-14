import { describe, expect, it } from 'vitest';
import { getStatusConfig } from '@/shared/utils/deviceStatus';

describe('deviceStatus', () => {
  it('returns semantic token classes for known device states', () => {
    expect(getStatusConfig('device')).toMatchObject({
      label: 'adb',
      variant: 'default',
      badgeClass: expect.stringContaining('bg-success-light'),
    });
    expect(getStatusConfig('unauthorized')).toMatchObject({
      label: 'unauthorized',
      variant: 'destructive',
      badgeClass: expect.stringContaining('text-'),
    });
  });
});
