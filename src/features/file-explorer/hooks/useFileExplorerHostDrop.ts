import { useEffect, useRef } from 'react';
import { OnFileDrop, OnFileDropOff } from '@/desktop/runtime';
import {
  closestFileExplorerDropTarget,
  destDirFromDropTarget,
  setDropOver,
} from '@/features/file-explorer/utils/fileExplorerDrop';

interface Options {
  currentPath: string;
  enabled: boolean;
  isBusy: boolean;
  onImport: (paths: string[], destDir: string) => void;
}

/** Window-level host file drop while File Explorer is mounted. Hover highlight
 *  is DOM-only so the virtual list does not re-render on every pointer move. */
export function useFileExplorerHostDrop(options: Options): void {
  const latestRef = useRef(options);
  const highlightedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    latestRef.current = options;
  });

  useEffect(() => {
    if (!options.enabled) {
      return;
    }

    const clearHighlight = () => {
      setDropOver(highlightedRef.current, false);
      highlightedRef.current = null;
    };

    OnFileDrop({
      onHover: (x, y) => {
        const next = closestFileExplorerDropTarget(x, y);
        if (highlightedRef.current === next) {
          return;
        }
        setDropOver(highlightedRef.current, false);
        highlightedRef.current = next;
        setDropOver(next, true);
      },
      onDrop: (paths, x, y) => {
        const destEl = closestFileExplorerDropTarget(x, y);
        clearHighlight();
        const latest = latestRef.current;
        if (latest.isBusy || paths.length === 0) {
          return;
        }
        const destDir = destDirFromDropTarget(destEl, latest.currentPath);
        if (!destDir) {
          return;
        }
        latest.onImport(paths, destDir);
      },
      onCancel: clearHighlight,
    });

    return () => {
      clearHighlight();
      OnFileDropOff();
    };
  }, [options.enabled]);
}
