import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewFlasher } from '@/features/flasher/FlasherView';
import { useDeviceStore } from '@/shared/stores/deviceStore';

vi.mock('@/desktop/backend', () => ({
  FlashPartition: vi.fn(),
  GetFastbootDevices: vi.fn().mockResolvedValue([]),
  Reboot: vi.fn(),
  RunFastbootHostCommand: vi.fn().mockResolvedValue(''),
  SelectImageFile: vi.fn(),
  SelectZipFile: vi.fn(),
  SetActiveSlot: vi.fn(),
  SideloadPackage: vi.fn(),
  WipeData: vi.fn(),
}));

vi.mock('@/desktop/runtime', () => ({
  OnFileDrop: vi.fn(() => () => {}),
  OnFileDropOff: vi.fn(),
}));

describe('ViewFlasher', () => {
  beforeEach(() => {
    useDeviceStore.getState().reset();
  });

  it('renders precision hero banner and 4 tab triggers', () => {
    render(<ViewFlasher />);

    expect(screen.getByRole('tab', { name: /overview & diagnostics/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /partition flasher/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /recovery sideload/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /partitions & wipe/i })).toBeInTheDocument();

    // Hero banner specs
    expect(screen.getByText('Protocol Mode')).toBeInTheDocument();
    expect(screen.getByText('Bootloader Lock')).toBeInTheDocument();
    expect(screen.getByText('Active Slot')).toBeInTheDocument();
    expect(screen.getByText('Product Board')).toBeInTheDocument();
  });

  it('renders overview tab with partition architecture and diagnostic matrix', () => {
    render(<ViewFlasher initialTab="overview" />);

    expect(screen.getByText('Android A/B Partition Architecture')).toBeInTheDocument();
    expect(screen.getByText('Pre-Flight Diagnostic Matrix')).toBeInTheDocument();
    expect(screen.getByText('Flasher Knowledge Base: Modes & Protocols')).toBeInTheDocument();
    expect(screen.getByText('Recent Flash History & Audit Log')).toBeInTheDocument();
  });

  it('renders partition helper text alongside the explicit field label in partition tab', () => {
    render(<ViewFlasher initialTab="partition" />);

    expect(screen.getByLabelText('Partition Name')).toBeInTheDocument();
    expect(
      screen.getByText('Choose a fastboot partition name or type a custom one.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Flash Partition Image')).toBeInTheDocument();
    expect(screen.getByText('Active Boot Slot Switcher')).toBeInTheDocument();
    expect(screen.getByText('Deterministic Multi-Partition Queue')).toBeInTheDocument();
  });

  it('renders sideload tab with drop area and pipeline tracker', () => {
    render(<ViewFlasher initialTab="sideload" />);

    expect(screen.getByText('Recovery Sideload Studio')).toBeInTheDocument();
    expect(screen.getByText('Sideload Pipeline & Execution Tracker')).toBeInTheDocument();
    expect(screen.getByText('Sideload Helper Utilities')).toBeInTheDocument();
  });

  it('renders wipe tab with safety gate and formatted wipe actions', () => {
    render(<ViewFlasher initialTab="wipe" />);

    expect(screen.getByText('Safety Interlock Gate')).toBeInTheDocument();
    expect(screen.getByText('Wipe Userdata (Factory Reset)')).toBeInTheDocument();
    expect(screen.getByText('Erase Cache Partition')).toBeInTheDocument();
    expect(screen.getByText('Erase Metadata Partition')).toBeInTheDocument();
    expect(screen.getByText('Erase System Partition')).toBeInTheDocument();
  });

  it('allows navigating between tabs via tab triggers', async () => {
    const user = userEvent.setup();
    render(<ViewFlasher />);

    expect(screen.getByText('Android A/B Partition Architecture')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /partition flasher/i }));
    expect(screen.getByLabelText('Partition Name')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /recovery sideload/i }));
    expect(screen.getByText('Recovery Sideload Studio')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /partitions & wipe/i }));
    expect(screen.getByText('Safety Interlock Gate')).toBeInTheDocument();
  });
});
