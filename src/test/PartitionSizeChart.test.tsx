import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PartitionSizeChart } from '@/features/payload-dumper/ui/PartitionSizeChart';

const MIB = 1024 ** 2;

describe('PartitionSizeChart', () => {
  it('renders one row per partition', () => {
    const { container, getByText } = render(
      <PartitionSizeChart
        data={[
          { extracted: false, name: 'super', size: 4096 * MIB },
          { extracted: true, name: 'system', size: 2048 * MIB },
          { extracted: false, name: 'boot', size: 64 * MIB },
        ]}
      />,
    );

    expect(container.querySelectorAll('li')).toHaveLength(3);
    expect(getByText('super')).toBeInTheDocument();
    expect(getByText('boot')).toBeInTheDocument();
  });

  it('scales bar width against the largest partition', () => {
    const { container } = render(
      <PartitionSizeChart
        data={[
          { extracted: false, name: 'super', size: 4096 * MIB },
          { extracted: false, name: 'half', size: 2048 * MIB },
        ]}
      />,
    );

    const bars = container.querySelectorAll('li > span > span');
    expect((bars[0] as HTMLElement).style.width).toBe('100%');
    expect((bars[1] as HTMLElement).style.width).toBe('50%');
  });

  it('recolours a partition once it has been extracted', () => {
    const { container } = render(
      <PartitionSizeChart
        data={[
          { extracted: true, name: 'system', size: 2048 * MIB },
          { extracted: false, name: 'boot', size: 2048 * MIB },
        ]}
      />,
    );

    const bars = container.querySelectorAll('li > span > span');
    expect((bars[0] as HTMLElement).style.backgroundColor).toBe('var(--chart-2)');
    expect((bars[1] as HTMLElement).style.backgroundColor).toBe('var(--chart-1)');
  });

  it('renders nothing when every partition is zero-sized', () => {
    const { container } = render(
      <PartitionSizeChart data={[{ extracted: false, name: 'empty', size: 0 }]} />,
    );

    expect(container.querySelector('ul')).toBeNull();
  });
});
