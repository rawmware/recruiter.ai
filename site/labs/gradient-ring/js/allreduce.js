// Two ways to sum gradients across N workers. Both return every worker's copy of the SUM
// plus a step-by-step transfer log the UI animates.

export function chunkBounds(len, n) {
  const base = Math.floor(len / n), extra = len % n, out = [];
  let s = 0;
  for (let c = 0; c < n; c++) { const e = s + base + (c < extra ? 1 : 0); out.push([s, e]); s = e; }
  return out;
}

// Ring all-reduce: each worker only talks to its neighbour, so per-worker traffic stays ~2x the model
// size no matter how many workers there are. Phase 1 (scatter-reduce) leaves each worker owning one
// fully-summed chunk. Phase 2 (all-gather) circulates the finished chunks.
export function ringAllReduce(vectors) {
  const n = vectors.length, len = vectors[0].length;
  const bufs = vectors.map((v) => Float64Array.from(v));
  const steps = [];
  if (n === 1) return { result: bufs, steps, bytesPerWorker: 0, hops: 0 };
  const bounds = chunkBounds(len, n);
  const mod = (a) => ((a % n) + n) % n;

  for (let phase = 0; phase < 2; phase++) {
    for (let s = 0; s < n - 1; s++) {
      const sends = [];
      for (let i = 0; i < n; i++) {
        const c = mod(phase === 0 ? i - s : i + 1 - s);
        const [a, b] = bounds[c];
        sends.push({ from: i, to: mod(i + 1), chunk: c, data: bufs[i].slice(a, b) });
      }
      // All sends in a step happen simultaneously, so payloads are copied before any receive is applied.
      for (const m of sends) {
        const [a] = bounds[m.chunk];
        for (let k = 0; k < m.data.length; k++) {
          if (phase === 0) bufs[m.to][a + k] += m.data[k]; else bufs[m.to][a + k] = m.data[k];
        }
      }
      steps.push({ phase: phase === 0 ? 'scatter-reduce' : 'all-gather', step: s, transfers: sends.map(({ from, to, chunk }) => ({ from, to, chunk })) });
    }
  }
  return { result: bufs, steps, bytesPerWorker: ((2 * (n - 1)) / n) * len * 4, hops: 2 * (n - 1) };
}

// Parameter server: everyone ships the whole gradient to one node, which sums and broadcasts.
// Correct, but the server's link carries N full copies each way.
export function serverAllReduce(vectors) {
  const n = vectors.length, len = vectors[0].length;
  const sum = new Float64Array(len);
  for (const v of vectors) for (let i = 0; i < len; i++) sum[i] += v[i];
  const steps = [
    { phase: 'push', step: 0, transfers: vectors.map((_, i) => ({ from: i, to: -1, chunk: 0 })) },
    { phase: 'broadcast', step: 0, transfers: vectors.map((_, i) => ({ from: -1, to: i, chunk: 0 })) },
  ];
  return { result: vectors.map(() => Float64Array.from(sum)), steps, bytesPerWorker: 2 * len * 4, serverBytes: 2 * n * len * 4, hops: 2 };
}
