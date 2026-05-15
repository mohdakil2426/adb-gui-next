import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewDashboard } from '@/features/dashboard/DashboardView';
import { useDeviceStore } from '@/shared/stores/deviceStore';

vi.mock('@/desktop/backend', () => ({
  ConnectWirelessAdb: vi.fn(),
  DisconnectWirelessAdb: vi.fn(),
  EnableWirelessAdb: vi.fn(),
  GetDeviceInfo: vi.fn(),
}));

function renderWithQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ViewDashboard activeView="dashboard" />
    </QueryClientProvider>,
  );
}

describe('ViewDashboard', () => {
  beforeEach(() => {
    useDeviceStore.getState().reset();
  });

  it('renders visible wireless adb field labels after expanding the card', async () => {
    const user = userEvent.setup();
    renderWithQueryClient();

    await user.click(screen.getByRole('button', { name: /Wireless ADB Connection/i }));

    expect(screen.getByText('Device IP Address')).toBeInTheDocument();
    expect(screen.getByText('Wireless ADB Port')).toBeInTheDocument();
  });
});
