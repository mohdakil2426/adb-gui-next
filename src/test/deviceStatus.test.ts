import { describe, expect, it } from 'vitest';
import { getStatusConfig } from '@/lib/deviceStatus';

describe('deviceStatus', () => {
  it('returns semantic token classes for known device states', () => {
    expect(getStatusConfig('device')).toMatchObject({
      label: 'adb',
      variant: 'default',
      badgeClass: expect.stringContaining('bg-[var(--device-status-adb-bg)]'),
    });
    expect(getStatusConfig('unauthorized')).toMatchObject({
      label: 'unauthorized',
      variant: 'destructive',
      badgeClass: expect.stringContaining('text-[var(--device-status-unauthorized-fg)]'),
    });
  });
});
