import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DirectoryTree } from '@/shared/components/DirectoryTree';

const listFilesMock = vi.fn();

vi.mock('@/desktop/backend', () => ({
  ListFiles: (...args: unknown[]) => listFilesMock(...args),
}));

describe('DirectoryTree', () => {
  beforeEach(() => {
    class ResizeObserverMock {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }

    global.ResizeObserver = ResizeObserverMock;
    listFilesMock.mockReset();
    listFilesMock.mockResolvedValue([]);
  });

  it('keeps the normal tree and exposes root instead of data', () => {
    render(<DirectoryTree currentPath="/sdcard/" onNavigate={vi.fn()} serial="device-a" />);

    const tree = screen.getByRole('tree', { name: 'Device filesystem' });
    const rootItems = within(tree).getAllByRole('treeitem');

    expect(rootItems).toHaveLength(3);
    expect(screen.getByText('sdcard')).toBeInTheDocument();
    expect(screen.getByText('storage')).toBeInTheDocument();
    expect(screen.getByText('root')).toBeInTheDocument();
    expect(screen.queryByText('data')).not.toBeInTheDocument();
  });

  it('uses root access only when the root node is expanded with a root-aware resolver', async () => {
    const user = userEvent.setup();

    render(
      <DirectoryTree
        currentPath="/sdcard/"
        getFileAccessMode={(targetPath) => (targetPath === '/' ? 'root' : 'normal')}
        onNavigate={vi.fn()}
        serial="device-a"
      />,
    );

    await user.click(screen.getByText('root'));
    const rootToggle = screen.getByRole('treeitem', { name: /root/i }).querySelector('span');
    expect(rootToggle).toBeTruthy();
    await user.click(rootToggle as HTMLElement);

    expect(listFilesMock).toHaveBeenCalledWith('/', 'device-a', 'root');
  });

  it('does not cap expanded directories so the tree scroll area owns overflow', async () => {
    const user = userEvent.setup();
    const entries = Array.from({ length: 60 }, (_, index) => ({
      date: '2026-05-15',
      name: `package.${index.toString().padStart(2, '0')}`,
      permissions: 'drwxr-xr-x',
      size: 0,
      time: '20:42',
      type: 'Directory',
    }));
    listFilesMock.mockResolvedValue(entries);

    const { container } = render(
      <DirectoryTree currentPath="/sdcard/" onNavigate={vi.fn()} serial="device-a" />,
    );

    const sdcardToggle = screen.getByRole('treeitem', { name: /sdcard/i }).querySelector('span');
    expect(sdcardToggle).toBeTruthy();
    await user.click(sdcardToggle as HTMLElement);

    expect(await screen.findByText('package.59')).toBeInTheDocument();
    expect(container.innerHTML).not.toContain('max-h-[500px]');
  });
});
