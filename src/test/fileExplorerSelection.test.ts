import { act, renderHook } from '@testing-library/react';
import type { MouseEvent } from 'react';
import { describe, expect, it } from 'vitest';
import { useFileExplorerSelection } from '@/features/file-explorer/hooks/useFileExplorerSelection';
import type { FileEntry } from '@/features/file-explorer/model/fileExplorerTypes';

const file: FileEntry = {
  date: '2026-01-01',
  linkTarget: '',
  name: 'photo.jpg',
  permissions: '-rw-rw----',
  size: '12',
  time: '12:00',
  type: 'File',
};

function clickEvent(overrides: Partial<MouseEvent> = {}): MouseEvent {
  return {
    ctrlKey: false,
    metaKey: false,
    preventDefault() {},
    shiftKey: false,
    ...overrides,
  } as MouseEvent;
}

describe('useFileExplorerSelection', () => {
  it('treats menu Select like Ctrl+click and ignores the leftover row click', () => {
    const { result } = renderHook(() =>
      useFileExplorerSelection({
        fileList: [file],
        renamingName: null,
        visibleList: [file],
      }),
    );

    act(() => {
      result.current.handleSelectFromMenu(file.name);
    });

    expect(result.current.isMultiSelectMode).toBe(true);
    expect(result.current.selectedNames.has(file.name)).toBe(true);

    act(() => {
      result.current.handleRowClick(file, clickEvent());
    });

    expect(result.current.isMultiSelectMode).toBe(true);
    expect(result.current.selectedNames.has(file.name)).toBe(true);
  });

  it('swallows the leftover empty-pane click after menu Select', () => {
    const { result } = renderHook(() =>
      useFileExplorerSelection({
        fileList: [file],
        renamingName: null,
        visibleList: [file],
      }),
    );

    act(() => {
      result.current.handleSelectFromMenu(file.name);
    });

    expect(result.current.consumeGhostClick()).toBe(true);
    expect(result.current.consumeGhostClick()).toBe(false);
    expect(result.current.isMultiSelectMode).toBe(true);
  });
});
