import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { backend } from '@/desktop/models';
import { TopStorageConsumersChart } from '@/features/app-manager/overview/charts/TopStorageConsumersChart';

const MIB = 1024 * 1024;

function consumer(
  packageName: string,
  totalMb: number,
  label?: string,
): backend.StorageConsumerItem {
  const totalSize = totalMb * MIB;
  return {
    packageName,
    label: label ?? packageName,
    appSize: totalSize * 0.5,
    dataSize: totalSize * 0.4,
    cacheSize: totalSize * 0.1,
    totalSize,
  };
}

describe('TopStorageConsumersChart', () => {
  it('renders at most 5 apps even when more are provided', () => {
    const consumers = [
      consumer('com.app.one', 1000, 'App One'),
      consumer('com.app.two', 900, 'App Two'),
      consumer('com.app.three', 800, 'App Three'),
      consumer('com.app.four', 700, 'App Four'),
      consumer('com.app.five', 600, 'App Five'),
      consumer('com.app.six', 500, 'App Six'),
      consumer('com.app.seven', 400, 'App Seven'),
    ];

    render(<TopStorageConsumersChart consumers={consumers} />);

    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('App One')).toBeInTheDocument();
    expect(screen.getByText('#5')).toBeInTheDocument();
    expect(screen.getByText('App Five')).toBeInTheDocument();

    expect(screen.queryByText('#6')).not.toBeInTheDocument();
    expect(screen.queryByText('App Six')).not.toBeInTheDocument();
    expect(screen.queryByText('#7')).not.toBeInTheDocument();
    expect(screen.queryByText('App Seven')).not.toBeInTheDocument();
  });

  it('strips quotes from labels and package names', () => {
    const consumers = [consumer('com.google.android.GoogleCamera"', 2400, 'GoogleCamera"')];

    render(<TopStorageConsumersChart consumers={consumers} />);

    expect(screen.getByText('GoogleCamera')).toBeInTheDocument();
    expect(screen.queryByText('GoogleCamera"')).not.toBeInTheDocument();
  });

  it('calls onSelectApp with stripped package name on click', () => {
    const onSelectApp = vi.fn();
    const consumers = [consumer('com.google.android.GoogleCamera"', 2400, 'GoogleCamera"')];

    render(<TopStorageConsumersChart consumers={consumers} onSelectApp={onSelectApp} />);

    fireEvent.click(screen.getByRole('button'));
    expect(onSelectApp).toHaveBeenCalledWith('com.google.android.GoogleCamera');
  });

  it('safely handles items with missing or undefined packageName without throwing', () => {
    const consumers = [
      {
        label: 'App Missing Pkg',
        appSize: 50 * MIB,
        dataSize: 40 * MIB,
        cacheSize: 10 * MIB,
        totalSize: 100 * MIB,
      } as unknown as backend.StorageConsumerItem,
    ];

    render(<TopStorageConsumersChart consumers={consumers} />);
    expect(screen.getByText('App Missing Pkg')).toBeInTheDocument();
  });

  it('renders empty placeholder when no storage consumers are provided', () => {
    render(<TopStorageConsumersChart consumers={[]} />);
    expect(screen.getByText('No storage telemetry available')).toBeInTheDocument();
  });
});
