const isDebug = import.meta.env.DEV || localStorage.getItem('debug') === 'true';

export function debugLog(...args: unknown[]): void {
  if (isDebug) {
    console.log('[DEBUG]', ...args);
  }
}

export function enableDebugMode(): void {
  localStorage.setItem('debug', 'true');
  console.log('Debug mode enabled. Reload to see verbose logs.');
}

export function disableDebugMode(): void {
  localStorage.removeItem('debug');
  console.log('Debug mode disabled. Reload to stop verbose logs.');
}

export function isDebugMode(): boolean {
  return isDebug;
}

export async function timedOperation<T>(name: string, operation: () => Promise<T>): Promise<T> {
  const start = performance.now();
  debugLog(`→ ${name}`);

  try {
    const result = await operation();
    const duration = (performance.now() - start).toFixed(0);
    debugLog(`✓ ${name} (${duration}ms)`);
    return result;
  } catch (err) {
    const duration = (performance.now() - start).toFixed(0);
    debugLog(`✗ ${name} (${duration}ms)`);
    throw err;
  }
}
