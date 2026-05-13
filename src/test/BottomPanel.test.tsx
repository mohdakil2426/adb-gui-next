import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BottomPanel } from '@/app/shell/BottomPanel/BottomPanel';
import { useLogStore } from '@/shared/stores/logStore';

vi.mock('@/shared/ui/sidebar', () => ({
  useSidebar: () => ({ state: 'expanded' }),
}));

vi.mock('@/desktop/backend', () => ({
  SaveLog: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
  writeText: vi.fn(),
}));

describe('BottomPanel', () => {
  beforeEach(() => {
    globalThis.ResizeObserver ??= class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as typeof ResizeObserver;

    useLogStore.setState({
      logs: [
        {
          id: '1',
          message: 'Something happened',
          type: 'info',
          timestamp: '12:00:00.000',
        },
      ],
      isOpen: true,
      activeTab: 'logs',
      filter: 'all',
      searchQuery: '',
      isFollowing: true,
      isPanelMaximized: false,
      unreadCount: 0,
      panelHeight: 300,
    });
  });

  it('opens the log filter menu and applies a level option', async () => {
    const user = userEvent.setup();

    render(<BottomPanel viewportHeight={900} />);

    await user.click(screen.getByLabelText('Filter Logs'));
    await user.click(screen.getByRole('menuitemradio', { name: 'Error' }));

    expect(useLogStore.getState().filter).toBe('error');
  });
});
