/**
 * Run async work one item at a time.
 * ADB package install/uninstall on a single device must stay serial to avoid pm races.
 * Uses a then-chain (not for-await) so order is preserved without concurrent adb pm calls.
 */
export function mapSerial<T, R>(
  items: readonly T[],
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  const chain = items.reduce<Promise<void>>(
    (previous, item, index) =>
      previous.then(() =>
        worker(item, index).then((value) => {
          results[index] = value;
        }),
      ),
    Promise.resolve(),
  );
  return chain.then(() => results);
}
