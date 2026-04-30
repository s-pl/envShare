/**
 * Run an async operation across an array in fixed-size batches with bounded
 * concurrency. The runner gets each batch and returns whatever the caller
 * needs (e.g. an aggregate). Progress is reported by item count, not batch
 * count, so callers can render a smooth progress bar.
 */
export async function runBatched<T, R>(
  items: T[],
  runner: (batch: T[]) => Promise<R>,
  opts: {
    batchSize?: number;
    concurrency?: number;
    onProgress?: (done: number, total: number) => void;
  } = {},
): Promise<R[]> {
  const batchSize = opts.batchSize ?? 10;
  const concurrency = opts.concurrency ?? 3;

  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) batches.push(items.slice(i, i + batchSize));

  const out: R[] = [];
  let done = 0;
  for (let i = 0; i < batches.length; i += concurrency) {
    const window = batches.slice(i, i + concurrency);
    const results = await Promise.all(window.map(b => runner(b)));
    out.push(...results);
    done += window.reduce((s, b) => s + b.length, 0);
    opts.onProgress?.(done, items.length);
  }
  return out;
}
