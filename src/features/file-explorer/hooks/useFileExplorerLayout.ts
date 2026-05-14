import { useCallback, useEffect } from 'react';
import {
  MAX_LEFT_WIDTH,
  MIN_LEFT_WIDTH,
  RESPONSIVE_COLLAPSE_WIDTH,
} from '@/features/file-explorer/model/fileExplorerConstants';

interface Options {
  containerRef: React.RefObject<HTMLDivElement | null>;
  isResizing: boolean;
  setIsResizing: (v: boolean) => void;
  setIsTreeCollapsed: (v: boolean) => void;
  setLeftWidth: (v: number) => void;
  wasResponsiveCollapsedRef: React.RefObject<boolean>;
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
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
    },
    [setIsResizing],
  );

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, [setIsResizing]);

  const resize = useCallback(
    (e: MouseEvent) => {
      if (!(isResizing && containerRef.current)) {
        return;
      }
      const rect = containerRef.current.getBoundingClientRect();
      setLeftWidth(Math.max(MIN_LEFT_WIDTH, Math.min(MAX_LEFT_WIDTH, e.clientX - rect.left)));
    },
    [containerRef, isResizing, setLeftWidth],
  );

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

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

  return { handleCollapseTree, handleExpandTree, startResizing };
}
