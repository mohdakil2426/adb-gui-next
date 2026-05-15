import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewFileExplorer } from '@/features/file-explorer/FileExplorerView';
import { useDeviceStore } from '@/shared/stores/deviceStore';

const longFileName =
  'flar2.devcheck_6.37-637_4arch_6dpi_95deb855a0cd5c3a0a02b45c11404c91_apkmirror.com.apkm';

const listFilesMock = vi.fn();
const verifyFileRootAccessMock = vi.fn();

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
  ListFiles: (...args: unknown[]) => listFilesMock(...args),
  PullFile: vi.fn(),
  PushFile: vi.fn(),
  RenameFile: vi.fn(),
  SelectDirectoryForPull: vi.fn(),
  SelectDirectoryToPush: vi.fn(),
  SelectFileToPush: vi.fn(),
  SelectSaveDirectory: vi.fn(),
  VerifyFileRootAccess: (...args: unknown[]) => verifyFileRootAccessMock(...args),
}));

describe('ViewFileExplorer', () => {
  beforeEach(() => {
    class ResizeObserverMock {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }

    global.ResizeObserver = ResizeObserverMock;
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1280,
    });
    localStorage.clear();
    useDeviceStore.getState().reset();
    useDeviceStore.getState().setDevices([{ serial: 'device-a', status: 'device' }]);
    listFilesMock.mockReset();
    verifyFileRootAccessMock.mockReset();
    verifyFileRootAccessMock.mockResolvedValue('Root access verified');
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

  it('keeps the file list as the owned scroll region', async () => {
    render(<ViewFileExplorer activeView="files" />);

    const row = await screen.findByText(longFileName);
    const scrollRegion = row.closest('.overflow-auto');

    expect(scrollRegion).toHaveClass('min-h-0');
    expect(scrollRegion).toHaveClass('flex-1');
    expect(scrollRegion).toHaveClass('overscroll-contain');
    expect(screen.getByRole('button', { name: 'More file actions' })).toHaveClass('xl:hidden');
  });

  it('uses a wide accessible resize handle for the tree panel', async () => {
    render(<ViewFileExplorer activeView="files" />);

    await screen.findByText(longFileName);
    const resizeHandle = screen.getByRole('separator', { name: 'Resize tree panel' });

    expect(resizeHandle).toHaveClass('w-3');
    expect(resizeHandle).toHaveAttribute('aria-valuemin', '220');
    expect(resizeHandle).toHaveAttribute('aria-valuemax', '520');
    expect(resizeHandle).toHaveAttribute('aria-valuenow', '280');

    fireEvent.keyDown(resizeHandle, { key: 'ArrowRight' });

    expect(resizeHandle).toHaveAttribute('aria-valuenow', '296');
  });

  it('verifies root access without navigating the whole explorer into root', async () => {
    const user = userEvent.setup();

    render(<ViewFileExplorer activeView="files" />);

    await screen.findByText(longFileName);
    await user.click(screen.getByRole('button', { name: 'Enable root access' }));

    expect(verifyFileRootAccessMock).toHaveBeenCalledWith('device-a');
    expect(listFilesMock).toHaveBeenLastCalledWith('/sdcard/', 'device-a', 'normal');
    expect(listFilesMock).not.toHaveBeenCalledWith('/', 'device-a', 'root');
    expect(screen.getByRole('button', { name: 'Disable root access' })).toHaveClass(
      'text-destructive',
    );
  });

  it('keeps normal root access grant state when verification fails', async () => {
    const user = userEvent.setup();
    verifyFileRootAccessMock.mockRejectedValue(new Error('su denied'));

    render(<ViewFileExplorer activeView="files" />);

    await screen.findByText(longFileName);
    await user.click(screen.getByRole('button', { name: 'Enable root access' }));

    expect(verifyFileRootAccessMock).toHaveBeenCalledWith('device-a');
    expect(listFilesMock).not.toHaveBeenCalledWith('/', expect.anything(), 'root');
  });
});
