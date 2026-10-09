import { makeRng } from './rng.js';
import { makeDataset } from './data.js';
import { makeLayout, initParams, gradSum, predict, makeActs } from './mlp.js';
import { ringAllReduce, serverAllReduce } from './allreduce.js';

export const SIZES = [2, 16, 16, 1];

// Synchronous data-parallel SGD with momentum. Every worker holds its own replica of the weights,
// computes a gradient on its shard of the global batch, all-reduces, and applies the same update.
export class Trainer {
  constructor({ workers = 4, batch = 64, lr = 0.15, momentum = 0.9, dataset = 'moons', algo = 'ring', seed = 11 } = {}) {
    this.cfg = { workers, batch, lr, momentum, dataset, algo, seed };
    this.layout = makeLayout(SIZES);
    this.rnd = makeRng(seed);
    this.data = makeDataset(dataset, 480, seed + 1);
    const init = initParams(this.layout, makeRng(seed + 2));
    this.replicas = Array.from({ length: workers }, () => Float64Array.from(init));
    this.velocity = Array.from({ length: workers }, () => new Float64Array(this.layout.size));
    this.order = this.rnd.shuffle([...Array(this.data.n).keys()]);
    this.cursor = 0;
    this.stepNo = 0;
    this.history = [];
    this.acts = makeActs(this.layout);
  }

  nextBatch() {
    const { batch } = this.cfg, out = [];
    while (out.length < batch) {
      if (this.cursor >= this.order.length) { this.rnd.shuffle(this.order); this.cursor = 0; }
      out.push(this.order[this.cursor++]);
    }
    return out;
  }

  // Contiguous, as-even-as-possible split of the global batch across workers.
  shards(batchIdx) {
    const n = this.cfg.workers, base = Math.floor(batchIdx.length / n), extra = batchIdx.length % n;
    let s = 0;
    return Array.from({ length: n }, (_, i) => { const e = s + base + (i < extra ? 1 : 0); const part = batchIdx.slice(s, e); s = e; return part; });
  }

  step() {
    const { workers, batch, lr, momentum, algo } = this.cfg;
    const L = this.layout, { X, y } = this.data;
    const idx = this.nextBatch();
    const shards = this.shards(idx);
    const local = shards.map((ix, w) => { const g = new Float64Array(L.size); const r = gradSum(L, this.replicas[w], X, y, ix, g); return { g, ...r }; });
    const comm = (algo === 'ring' ? ringAllReduce : serverAllReduce)(local.map((l) => l.g));

    // Reference: one machine, whole batch, same weights. The all-reduced sum must match it.
    const ref = new Float64Array(L.size);
    gradSum(L, this.replicas[0], X, y, idx, ref);
    let maxDiff = 0;
    for (let i = 0; i < L.size; i++) maxDiff = Math.max(maxDiff, Math.abs(ref[i] - comm.result[0][i]));

    for (let w = 0; w < workers; w++) {
      const p = this.replicas[w], v = this.velocity[w], g = comm.result[w];
      for (let i = 0; i < L.size; i++) { v[i] = momentum * v[i] - (lr * g[i]) / batch; p[i] += v[i]; }
    }
    let divergence = 0;
    for (let w = 1; w < workers; w++) for (let i = 0; i < L.size; i++) divergence = Math.max(divergence, Math.abs(this.replicas[w][i] - this.replicas[0][i]));

    const loss = local.reduce((a, l) => a + l.loss, 0) / batch;
    const acc = local.reduce((a, l) => a + l.correct, 0) / batch;
    this.stepNo++;
    const rec = { step: this.stepNo, loss, acc, maxDiff, divergence, shardSizes: shards.map((s) => s.length) };
    this.history.push(rec);
    return { ...rec, comm: { steps: comm.steps, bytesPerWorker: comm.bytesPerWorker, serverBytes: comm.serverBytes ?? null, hops: comm.hops }, shards };
  }

  evaluate() {
    const { X, y, n } = this.data;
    let correct = 0;
    for (let i = 0; i < n; i++) if ((predict(this.layout, this.replicas[0], X[2 * i], X[2 * i + 1], this.acts) > 0.5) === (y[i] === 1)) correct++;
    return correct / n;
  }

  prob(x0, x1) { return predict(this.layout, this.replicas[0], x0, x1, this.acts); }
}
