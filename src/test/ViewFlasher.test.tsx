import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewFlasher } from '@/features/flasher/FlasherView';
import { useDeviceStore } from '@/shared/stores/deviceStore';

vi.mock('@/desktop/backend', () => ({
  FlashPartition: vi.fn(),
  SelectImageFile: vi.fn(),
  SelectZipFile: vi.fn(),
  SideloadPackage: vi.fn(),
  WipeData: vi.fn(),
}));

vi.mock('@/desktop/runtime', () => ({
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
