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
    expect(screen.getByRole('button', { name: 'More file actions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse tree panel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^New/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Internal storage' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
    expect(screen.getByText('Root')).toBeInTheDocument();
    expect(screen.getByText('Storage')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Date modified/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Type/ })).toBeInTheDocument();
  });

  it('clears a row selection on empty list click and never shows a selection summary bar', async () => {
    const user = userEvent.setup();

    render(<ViewFileExplorer activeView="files" />);

    const row = await screen.findByText(longFileName);
    await user.click(row);

    expect(row.closest('[data-state="selected"]')).not.toBeNull();
    expect(
      screen.queryByRole('checkbox', { name: `Select ${longFileName}` }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/items selected/)).not.toBeInTheDocument();

    const scrollRegion = row.closest('.overflow-auto');
    expect(scrollRegion).not.toBeNull();
    fireEvent.click(scrollRegion as HTMLElement);

    expect(row.closest('[data-state="selected"]')).toBeNull();
  });

  it('shows row checkboxes after a modifier click, not a plain click', async () => {
    const user = userEvent.setup();

    render(<ViewFileExplorer activeView="files" />);

    const row = await screen.findByText(longFileName);
    expect(
      screen.queryByRole('checkbox', { name: `Select ${longFileName}` }),
    ).not.toBeInTheDocument();

    await user.keyboard('{Control>}');
    await user.click(row);
    await user.keyboard('{/Control}');

    expect(screen.getByRole('checkbox', { name: `Select ${longFileName}` })).toBeChecked();
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

  it('keeps the tree toggle on the command band after collapsing', async () => {
    const user = userEvent.setup();

    render(<ViewFileExplorer activeView="files" />);

    await screen.findByText(longFileName);
    await user.click(screen.getByRole('button', { name: 'Collapse tree panel' }));

    expect(screen.getByRole('button', { name: 'Show tree panel' })).toBeInTheDocument();
    expect(screen.queryByRole('separator', { name: 'Resize tree panel' })).not.toBeInTheDocument();
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

  it('shows the no-device state from the device store, not from adb error text', async () => {
    useDeviceStore.getState().reset();

    render(<ViewFileExplorer activeView="files" />);

    expect(await screen.findByText('No device connected')).toBeInTheDocument();
    expect(screen.getByText(/Connect a device over USB/)).toBeInTheDocument();
  });

  it('navigates to an ancestor from a breadcrumb segment', async () => {
    const user = userEvent.setup();
    localStorage.setItem('fe.currentPath', '/sdcard/Download/');

    render(<ViewFileExplorer activeView="files" />);

    await screen.findByText(longFileName);
    // Ancestors are real controls, not decorative text: clicking one jumps
    // straight there instead of requiring repeated presses of the up arrow.
    await user.click(screen.getByRole('button', { name: 'sdcard' }));

    expect(listFilesMock).toHaveBeenLastCalledWith('/sdcard/', 'device-a', 'normal');
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
