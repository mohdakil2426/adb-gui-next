import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewFlasher } from '@/components/views/ViewFlasher';
import { useDeviceStore } from '@/lib/deviceStore';

vi.mock('@/lib/desktop/backend', () => ({
  FlashPartition: vi.fn(),
  SelectImageFile: vi.fn(),
  SelectZipFile: vi.fn(),
  SideloadPackage: vi.fn(),
  WipeData: vi.fn(),
}));

vi.mock('@/lib/desktop/runtime', () => ({
  OnFileDrop: vi.fn(),
  OnFileDropOff: vi.fn(),
}));

describe('ViewFlasher', () => {
  beforeEach(() => {
    useDeviceStore.getState().reset();
  });

  it('renders partition helper text alongside the explicit field label', () => {
    render(<ViewFlasher />);

    expect(screen.getByLabelText('Partition Name')).toBeInTheDocument();
    expect(
      screen.getByText('Choose a fastboot partition name or type a custom one.'),
    ).toBeInTheDocument();
  });
});
