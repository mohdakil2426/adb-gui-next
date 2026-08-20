/**
 * Executes asynchronous tasks sequentially across an array of items.
 * Used for hardware and ADB daemon protocol interactions where concurrent
 * operations cause race conditions or device instability.
 */
export function runSerial<T, R>(
  items: readonly T[],
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  return items.reduce<Promise<R[]>>(
    (promiseChain, item, index) =>
      promiseChain.then((accumulatedResults) =>
        worker(item, index).then((result) => [...accumulatedResults, result]),
      ),
    Promise.resolve([]),
  );
}
