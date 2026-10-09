// Analytical step-time model. The toy network is tiny, so to explore realistic regimes the user
// sets a "virtual" model size; the maths below is the standard alpha-beta communication model:
//   time = latency * messages + bytes / bandwidth
export function stepTime({ n, batch, msPerSample, modelMB, bandwidthGBps, latencyMs, overlap = 0, algo = 'ring', straggler = 1 }) {
  const compute = Math.ceil(batch / n) * msPerSample * (n > 1 ? straggler : 1);
  if (n === 1) return { compute, comm: 0, exposed: 0, total: compute };
  const bytes = modelMB * 1e6;
  const bw = bandwidthGBps * 1e9; // bytes per second
  let comm;
  if (algo === 'ring') comm = 2 * (n - 1) * latencyMs + ((2 * (n - 1)) / n) * (bytes / bw) * 1000;
  else comm = 2 * latencyMs + ((2 * n * bytes) / bw) * 1000; // the server link is the bottleneck
  // Overlap hides communication behind the backward pass, but never more than the compute available.
  const hidden = Math.min(comm * overlap, compute * 0.6);
  return { compute, comm, exposed: comm - hidden, total: compute + comm - hidden };
}

export function scalingCurve(params, maxN = 64) {
  const base = stepTime({ ...params, n: 1 }).total;
  const rows = [];
  for (let n = 1; n <= maxN; n *= 2) {
    const t = stepTime({ ...params, n });
    const speedup = base / t.total;
    rows.push({ n, ...t, speedup, efficiency: speedup / n });
  }
  return rows;
}
