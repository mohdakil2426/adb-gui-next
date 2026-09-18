/**
 * Executes asynchronous tasks sequentially across an array of items.
 * Used for hardware and ADB daemon protocol interactions where concurrent
 * operations cause race conditions or device instability.
 */
export const runSerial = async <T, R>(
  items: readonly T[],
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
  const results: R[] = [];
  for (const [i, item] of items.entries()) {
    results.push(await worker(item, i));
  }
  return results;
};
