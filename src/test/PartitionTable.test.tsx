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
        extractingPartitions={new Set()}
        isExtractionActive={false}
        onToggle={onToggle}
        onToggleAll={() => {}}
        partitionProgress={new Map()}
        partitions={[
          { name: 'boot', selected: true, size: 4096 },
          { name: 'vendor_boot', selected: true, size: 8192 },
        ]}
        status="ready"
      />,
    );

    await user.type(screen.getByPlaceholderText('Search partitions...'), 'vendor');
    await user.click(screen.getByRole('checkbox', { name: /vendor_boot\.img/i }));

    expect(onToggle).toHaveBeenCalledWith(1);
  });
});
