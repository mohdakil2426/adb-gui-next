import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RemoteLoadProgressCard } from '@/features/payload-dumper/ui/RemoteLoadProgressCard';

describe('RemoteLoadProgressCard', () => {
  it('renders stages and not-full-download copy', () => {
    render(
      <RemoteLoadProgressCard
        estimatedSizeLabel="3.52 GB"
        message="Locating package index…"
        onCancel={() => {}}
        phase="locateIndex"
        startedAt={Date.now() - 18_000}
        step={2}
        totalSteps={4}
      />,
    );

    expect(screen.getByText('Loading partitions')).toBeInTheDocument();
    expect(screen.getByText('Verify connection')).toBeInTheDocument();
    expect(screen.getByText('Locate ZIP index')).toBeInTheDocument();
    expect(screen.getByText(/not downloading full 3\.52 GB/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel loading partitions/i })).toBeInTheDocument();
  });

  it('invokes onCancel when cancel is pressed', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(
      <RemoteLoadProgressCard
        onCancel={onCancel}
        phase="verifyConnection"
        startedAt={Date.now()}
        step={1}
      />,
    );

    await user.click(screen.getByRole('button', { name: /cancel loading partitions/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
