import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewFileExplorer } from '@/features/file-explorer/FileExplorerView';
import { useDeviceStore } from '@/shared/stores/deviceStore';

const longFileName =
  'flar2.devcheck_6.37-637_4arch_6dpi_95deb855a0cd5c3a0a02b45c11404c91_apkmirror.com.apkm';

const listFilesMock = vi.fn();

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getTotalSize: () => 40,
    getVirtualItems: () => [
      {
        index: 0,
        key: longFileName,
        size: 40,
        start: 0,
      },
    ],
    measureElement: vi.fn(),
  }),
}));

vi.mock('@/desktop/backend', () => ({
  CreateDirectory: vi.fn(),
  CreateFile: vi.fn(),
  DeleteFiles: vi.fn(),
  ListFiles: () => listFilesMock(),
  PullFile: vi.fn(),
  PushFile: vi.fn(),
  RenameFile: vi.fn(),
  SelectDirectoryForPull: vi.fn(),
  SelectDirectoryToPush: vi.fn(),
  SelectFileToPush: vi.fn(),
  SelectSaveDirectory: vi.fn(),
}));

describe('ViewFileExplorer', () => {
  beforeEach(() => {
    class ResizeObserverMock {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }

    global.ResizeObserver = ResizeObserverMock;
    localStorage.clear();
    useDeviceStore.getState().reset();
    useDeviceStore.getState().setDevices([{ serial: 'device-a', status: 'device' }]);
    listFilesMock.mockReset();
    listFilesMock.mockResolvedValue([
      {
        date: '2026-05-10',
        linkTarget: '',
        name: longFileName,
        permissions: '-rw-r--r--',
        size: '1024',
        time: '19:17',
        type: 'File',
      },
    ]);
  });

  it('wraps long filenames in the delete confirmation dialog', async () => {
    const user = userEvent.setup();

    render(<ViewFileExplorer activeView="files" />);

    const row = await screen.findByText(longFileName);
    await user.click(row);
    await user.keyboard('{Delete}');

    const title = await screen
      .findByRole('alertdialog')
      .then((dialog) => dialog.querySelector('[data-slot="alert-dialog-title"]'));

    expect(title).toHaveClass('min-w-0');
    expect(title).toHaveClass('whitespace-normal');
    expect(title).toHaveClass('[overflow-wrap:anywhere]');
    expect(title).toHaveTextContent(longFileName);
  });
});
