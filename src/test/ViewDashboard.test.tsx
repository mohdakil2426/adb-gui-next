import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
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

  it('renders visible wireless adb field labels', () => {
    renderWithQueryClient();

    expect(screen.getByText('Device IP Address')).toBeInTheDocument();
    expect(screen.getByText('Wireless ADB Port')).toBeInTheDocument();
  });
});
