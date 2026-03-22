import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectedDevicesCard } from '../components/ConnectedDevicesCard';

// Mock nicknameStore — return undefined (no nicknames set)
vi.mock('../lib/nicknameStore', () => ({
  getNickname: vi.fn(() => undefined),
}));

const mockOnRefresh = vi.fn();
const mockOnEdit = vi.fn();

describe('ConnectedDevicesCard', () => {
  it('renders the "Connected Devices" heading', () => {
    render(
      <ConnectedDevicesCard
        devices={[]}
        isLoading={false}
        onRefresh={mockOnRefresh}
        onEdit={mockOnEdit}
      />,
    );
    expect(screen.getByText('Connected Devices')).toBeInTheDocument();
  });

  it('shows the default empty state message when no devices', () => {
    render(
      <ConnectedDevicesCard
        devices={[]}
        isLoading={false}
        onRefresh={mockOnRefresh}
        onEdit={mockOnEdit}
      />,
    );
    expect(
      screen.getByText('No device detected. Ensure USB Debugging is enabled.'),
    ).toBeInTheDocument();
  });

  it('shows a custom empty text message', () => {
    render(
      <ConnectedDevicesCard
        devices={[]}
        isLoading={false}
        onRefresh={mockOnRefresh}
        onEdit={mockOnEdit}
        emptyText="Custom empty state"
      />,
    );
    expect(screen.getByText('Custom empty state')).toBeInTheDocument();
  });

  it('shows scanning message when loading with no devices', () => {
    render(
      <ConnectedDevicesCard
        devices={[]}
        isLoading={true}
        onRefresh={mockOnRefresh}
        onEdit={mockOnEdit}
      />,
    );
    expect(screen.getByText('Scanning for devices...')).toBeInTheDocument();
  });

  it('renders a device with its serial number', () => {
    render(
      <ConnectedDevicesCard
        devices={[{ serial: 'abc123', status: 'device' }]}
        isLoading={false}
        onRefresh={mockOnRefresh}
        onEdit={mockOnEdit}
      />,
    );
    expect(screen.getByText('abc123')).toBeInTheDocument();
  });

  it('shows "adb" status text for device in adb mode', () => {
    render(
      <ConnectedDevicesCard
        devices={[{ serial: 'abc123', status: 'device' }]}
        isLoading={false}
        onRefresh={mockOnRefresh}
        onEdit={mockOnEdit}
      />,
    );
    expect(screen.getByText('adb')).toBeInTheDocument();
  });

  it('calls onRefresh when refresh button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ConnectedDevicesCard
        devices={[]}
        isLoading={false}
        onRefresh={mockOnRefresh}
        onEdit={mockOnEdit}
      />,
    );
    // The refresh button is the only button in empty state
    const button = screen.getByRole('button');
    await user.click(button);
    expect(mockOnRefresh).toHaveBeenCalledOnce();
  });
});
