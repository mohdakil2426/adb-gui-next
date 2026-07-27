import { useEffect, useState } from 'react';

/** Never hold the splash longer than this, however slow font loading is. */
const READY_TIMEOUT_MS = 2000;

/**
 * Resolves when the app is genuinely ready to paint: web fonts have settled and
 * the browser has committed a frame.
 *
 * This replaces a hard-coded 750ms `requestAnimationFrame` progress animation that
 * ran on every launch regardless of whether anything was actually loading — pure
 * added latency. The timeout is a ceiling, not a target: on a warm start this
 * resolves in a frame or two.
 */
export function useAppReady(): boolean {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const markReady = () => {
      if (!cancelled) {
        setIsReady(true);
      }
    };

    const timeoutId = window.setTimeout(markReady, READY_TIMEOUT_MS);
    const fontsReady = document.fonts?.ready ?? Promise.resolve();

    fontsReady
      .catch(() => undefined)
      .then(() => {
        // One more frame so the first paint uses the loaded faces.
        requestAnimationFrame(markReady);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  return isReady;
}
