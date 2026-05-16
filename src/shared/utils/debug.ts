const isDebug = import.meta.env.DEV || localStorage.getItem('debug') === 'true';

export function debugLog(...args: unknown[]): void {
  if (isDebug) {
    console.log('[DEBUG]', ...args);
  }
}
