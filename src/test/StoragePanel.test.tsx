import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { backend } from '@/desktop/models';
import { StoragePanel } from '@/features/dashboard/ui/StoragePanel';

const GIB = 1024 ** 3;

function volume(overrides: Partial<backend.StorageVolume>): backend.StorageVolume {
  return {
    mount: '/data',
    rawMount: '/data',
    totalBytes: 110 * GIB,
    usedBytes: 42 * GIB,
    freeBytes: 68 * GIB,
    ...overrides,
  };
}

describe('StoragePanel', () => {
  it('labels /data as Internal storage and keeps the raw mount visible underneath', () => {
    render(
      <StoragePanel isLoading={false} volumes={[volume({ mount: '/data', rawMount: '/data' })]} />,
    );

    expect(screen.getByText('Internal storage')).toBeInTheDocument();
    expect(screen.getByText('/data')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Internal storage used' })).toBeInTheDocument();
  });

  it('labels /storage/emulated and /sdcard as Shared storage', () => {
    render(
      <StoragePanel
        isLoading={false}
        volumes={[volume({ mount: '/storage/emulated', rawMount: '/storage/emulated' })]}
      />,
    );

    expect(screen.getByText('Shared storage')).toBeInTheDocument();
  });

  it('labels a removable media_rw mount as SD card', () => {
    render(
      <StoragePanel
        isLoading={false}
        volumes={[
          volume({ mount: '/mnt/media_rw/1234-5678', rawMount: '/mnt/media_rw/1234-5678' }),
        ]}
      />,
    );

    expect(screen.getByText('SD card')).toBeInTheDocument();
  });

  it('never renders an APEX (or other) raw mount as the headline, only as diagnostic text', () => {
    // Regression case: a real device resolved df's own "Mounted on" column to an APEX
    // bind mount instead of the queried path. The panel must show the requested path's
    // label as the headline, and the bogus raw mount only as hover-only diagnostic text.
    render(
      <StoragePanel
        isLoading={false}
        volumes={[
          volume({
            mount: '/data',
            rawMount: '/apex/com.android.art/bin/dex2oat64',
          }),
        ]}
      />,
    );

    expect(screen.getByText('Internal storage')).toBeInTheDocument();
    expect(screen.queryByText('/apex/com.android.art/bin/dex2oat64')).not.toBeInTheDocument();
    expect(screen.getByText('/data')).toHaveAttribute(
      'title',
      '/data (df reported: /apex/com.android.art/bin/dex2oat64)',
    );
  });

  it('renders one row per distinct volume with correct usage figures', () => {
    render(
      <StoragePanel
        isLoading={false}
        volumes={[
          volume({
            mount: '/data',
            rawMount: '/data',
            totalBytes: 110 * GIB,
            usedBytes: 42 * GIB,
            freeBytes: 68 * GIB,
          }),
          volume({
            mount: '/mnt/media_rw/1234-5678',
            rawMount: '/mnt/media_rw/1234-5678',
            totalBytes: 64 * GIB,
            usedBytes: 32 * GIB,
            freeBytes: 32 * GIB,
          }),
        ]}
      />,
    );

    expect(screen.getByText('42.0 GB of 110.0 GB')).toBeInTheDocument();
    expect(screen.getByText('32.0 GB of 64.0 GB')).toBeInTheDocument();
  });

  it('shows an honest empty state instead of an empty card when every volume was filtered out', () => {
    render(<StoragePanel isLoading={false} volumes={[]} />);

    expect(screen.getByText(/no user-facing storage volumes were reported/i)).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('shows loading skeletons instead of the empty state while the first load is in flight', () => {
    render(<StoragePanel isLoading={true} volumes={[]} />);

    expect(
      screen.queryByText(/no user-facing storage volumes were reported/i),
    ).not.toBeInTheDocument();
  });
});
