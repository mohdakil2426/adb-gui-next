import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

const MIN_HEIGHT = 120;
const MAX_HEIGHT_RATIO = 0.7;

interface ResizeOptions {
  setPanelHeight: (height: number) => void;
  viewportHeight: number;
}

export function useBottomPanelResize({ viewportHeight, setPanelHeight }: ResizeOptions) {
  const panelRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);
  const rafRef = useRef<number>(0);
  const [showCursorOverlay, setShowCursorOverlay] = useState(false);

  // ── Fluid resize: DOM-first, commit-last ─────────────────────────────────────
  // During drag: height updated via direct DOM style — NO React re-renders.
  // On mouseup: single Zustand commit — one React re-render to sync.
  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    setShowCursorOverlay(true);
    // Hint to GPU: this element's height will animate
    if (panelRef.current) {
      Object.assign(panelRef.current.style, { willChange: 'height', userSelect: 'none' });
    }
  }, []);

  const stopResizing = useCallback(() => {
    if (!isResizingRef.current) {
      return;
    }
    isResizingRef.current = false;
    cancelAnimationFrame(rafRef.current);
    setShowCursorOverlay(false);
    // Commit the final height to the store — single re-render after drag ends
    if (panelRef.current) {
      Object.assign(panelRef.current.style, { willChange: '', userSelect: '' });
      const finalHeight = Number.parseFloat(panelRef.current.style.height);
      if (!isNaN(finalHeight)) {
        setPanelHeight(finalHeight);
      }
    }
  }, [setPanelHeight]);

  const resize = useCallback(
    (e: MouseEvent) => {
      if (!isResizingRef.current) {
        return;
      }
      // RAF throttle: skip frames the browser can't render anyway
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const maxHeight = viewportHeight * MAX_HEIGHT_RATIO;
        const rawHeight = viewportHeight - e.clientY;
        const clampedHeight = Math.max(MIN_HEIGHT, Math.min(maxHeight, rawHeight));
        // Direct DOM write — bypasses React render pipeline entirely
        if (panelRef.current) {
          panelRef.current.style.height = `${clampedHeight}px`;
        }
      });
    },
    [viewportHeight],
  );

  // Register once — stable refs mean no listener churn
  useEffect(() => {
    window.addEventListener('mousemove', resize, { passive: true });
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  return {
    panelRef,
    startResizing,
    showCursorOverlay,
    MAX_HEIGHT_RATIO,
  };
}
