import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PartitionTable } from '@/features/payload-dumper/ui/PartitionTable';

describe('PartitionTable', () => {
  it('toggles the original partition when search filters rows', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <PartitionTable
        completedPartitions={new Set()}
        isExtractionActive={false}
        onToggle={onToggle}
        onToggleAll={() => {}}
        partitionProgress={new Map()}
        partitionStatuses={new Map()}
        partitions={[
          { name: 'boot', selected: true, size: 4096 },
          { name: 'vendor_boot', selected: true, size: 8192 },
        ]}
        status="ready"
      />,
    );

    await user.type(screen.getByLabelText('Search partitions'), 'vendor');
    await user.click(screen.getByRole('checkbox', { name: /vendor_boot\.img/i }));

    expect(onToggle).toHaveBeenCalledWith(1);
  });

  it('shows per-partition extract status badges during extraction', () => {
    render(
      <PartitionTable
        completedPartitions={new Set(['system'])}
        isExtractionActive
        onToggle={() => {}}
        onToggleAll={() => {}}
        partitionProgress={
          new Map([
            ['boot', { current: 2, total: 10, percentage: 20, throughputMbps: 42.5 }],
            ['system', { current: 5, total: 5, percentage: 100, throughputMbps: 0 }],
          ])
        }
        partitionStatuses={
          new Map([
            ['boot', 'running'],
            ['vendor', 'pending'],
            ['system', 'completed'],
            ['dtbo', 'failed'],
          ])
        }
        partitions={[
          { name: 'boot', selected: true, size: 4096 },
          { name: 'vendor', selected: true, size: 2048 },
          { name: 'system', selected: false, size: 8192 },
          { name: 'dtbo', selected: true, size: 1024 },
        ]}
        status="extracting"
      />,
    );

    expect(screen.getByText('running')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
    expect(screen.getByText('42.5 MB/s')).toBeInTheDocument();
    expect(screen.getByText(/1 failed/)).toBeInTheDocument();
  });
});
