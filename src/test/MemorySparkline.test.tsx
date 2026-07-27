import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MemorySample } from '@/features/dashboard/model/memoryHistoryStore';
import { MemorySparkline } from '@/features/dashboard/ui/MemorySparkline';

const GIB = 1024 ** 3;

function sample(offsetMs: number, usedGib: number): MemorySample {
  return { at: 1_800_000_000_000 + offsetMs, totalBytes: 8 * GIB, usedBytes: usedGib * GIB };
}

describe('MemorySparkline', () => {
  it('plots one point per sample', () => {
    const { container } = render(
      <MemorySparkline samples={[sample(0, 5), sample(15_000, 6), sample(30_000, 5.5)]} />,
    );

    const polyline = container.querySelector('polyline');
    expect(polyline).not.toBeNull();
    expect(polyline?.getAttribute('points')?.trim().split(/\s+/)).toHaveLength(3);
  });

  it('themes the series through the chart ramp token', () => {
    const { container } = render(<MemorySparkline samples={[sample(0, 4), sample(15_000, 4.5)]} />);

    expect(container.querySelector('polyline')?.getAttribute('stroke')).toBe('var(--chart-1)');
  });

  it('inverts the y axis so higher usage sits higher in the box', () => {
    const { container } = render(<MemorySparkline samples={[sample(0, 2), sample(15_000, 7)]} />);

    const [first, second] = (container.querySelector('polyline')?.getAttribute('points') ?? '')
      .trim()
      .split(/\s+/)
      .map((pair) => Number(pair.split(',')[1]));

    // 7 GiB of 8 is a higher bar, i.e. a smaller SVG y.
    expect(second).toBeLessThan(first as number);
  });

  it('reads out the latest sample before any hover', () => {
    const { getByText } = render(<MemorySparkline samples={[sample(0, 2), sample(15_000, 6)]} />);

    expect(getByText(/6\.0 GB/)).toBeInTheDocument();
    expect(getByText(/75(\.0)?%/)).toBeInTheDocument();
  });

  it('renders nothing without samples', () => {
    const { container } = render(<MemorySparkline samples={[]} />);

    expect(container.querySelector('svg')).toBeNull();
  });
});
