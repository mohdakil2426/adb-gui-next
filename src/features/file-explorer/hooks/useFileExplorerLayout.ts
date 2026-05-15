import { useCallback, useEffect } from 'react';
import {
  MAX_LEFT_WIDTH,
  MIN_LEFT_WIDTH,
  RESPONSIVE_COLLAPSE_WIDTH,
} from '@/features/file-explorer/model/fileExplorerConstants';

const RESIZE_KEY_STEP = 16;

interface Options {
  containerRef: React.RefObject<HTMLDivElement | null>;
  isResizing: boolean;
  setIsResizing: (v: boolean) => void;
  setIsTreeCollapsed: (v: boolean) => void;
  setLeftWidth: React.Dispatch<React.SetStateAction<number>>;
  wasResponsiveCollapsedRef: React.RefObject<boolean>;
}

function clampLeftWidth(width: number): number {
  return Math.max(MIN_LEFT_WIDTH, Math.min(MAX_LEFT_WIDTH, width));
}

export function useFileExplorerLayout(options: Options) {
  const {
    containerRef,
    isResizing,
    setIsResizing,
    setIsTreeCollapsed,
    setLeftWidth,
    wasResponsiveCollapsedRef,
  } = options;

  const toggleTree = useCallback(
    (collapsed: boolean) => {
      wasResponsiveCollapsedRef.current = false;
      setIsTreeCollapsed(collapsed);
      localStorage.setItem('fe.treeCollapsed', String(collapsed));
    },
    [setIsTreeCollapsed, wasResponsiveCollapsedRef],
  );

  const startResizing = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsResizing(true);
    },
    [setIsResizing],
  );

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, [setIsResizing]);

  const resize = useCallback(
    (e: PointerEvent) => {
      if (!(isResizing && containerRef.current)) {
        return;
      }
      const rect = containerRef.current.getBoundingClientRect();
      setLeftWidth(clampLeftWidth(e.clientX - rect.left));
    },
    [containerRef, isResizing, setLeftWidth],
  );

  useEffect(() => {
    window.addEventListener('pointermove', resize);
    window.addEventListener('pointerup', stopResizing);
    window.addEventListener('pointercancel', stopResizing);
    return () => {
      window.removeEventListener('pointermove', resize);
      window.removeEventListener('pointerup', stopResizing);
      window.removeEventListener('pointercancel', stopResizing);
    };
  }, [resize, stopResizing]);

  const handleResizeKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
        return;
      }
      e.preventDefault();
      const direction = e.key === 'ArrowRight' ? 1 : -1;
      setLeftWidth((width) => clampLeftWidth(width + direction * RESIZE_KEY_STEP));
    },
    [setLeftWidth],
  );

  useEffect(() => {
    let prevWasSmall = window.innerWidth <= RESPONSIVE_COLLAPSE_WIDTH;
    if (prevWasSmall && localStorage.getItem('fe.treeCollapsed') !== 'true') {
      wasResponsiveCollapsedRef.current = true;
      setIsTreeCollapsed(true);
    }
    const onWindowResize = () => {
      const isSmall = window.innerWidth <= RESPONSIVE_COLLAPSE_WIDTH;
      if (isSmall && !prevWasSmall) {
        wasResponsiveCollapsedRef.current = true;
        setIsTreeCollapsed(true);
      } else if (!isSmall && prevWasSmall && wasResponsiveCollapsedRef.current) {
        wasResponsiveCollapsedRef.current = false;
        setIsTreeCollapsed(false);
      }
      prevWasSmall = isSmall;
    };
    window.addEventListener('resize', onWindowResize);
    return () => window.removeEventListener('resize', onWindowResize);
  }, [setIsTreeCollapsed, wasResponsiveCollapsedRef]);

  const handleCollapseTree = useCallback(() => toggleTree(true), [toggleTree]);
  const handleExpandTree = useCallback(() => toggleTree(false), [toggleTree]);

  return { handleCollapseTree, handleExpandTree, handleResizeKeyDown, startResizing };
}
