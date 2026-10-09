import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../site/labs/gradient-ring/js/rng.js';
import { ringAllReduce, serverAllReduce, chunkBounds } from '../site/labs/gradient-ring/js/allreduce.js';
import { stepTime, scalingCurve } from '../site/labs/gradient-ring/js/costmodel.js';
import { Trainer } from '../site/labs/gradient-ring/js/trainer.js';

const vecs = (n, len, seed = 1) => { const r = makeRng(seed); return Array.from({ length: n }, () => Float64Array.from({ length: len }, () => r.normal())); };
const trueSum = (vs) => Array.from(vs[0], (_, i) => vs.reduce((a, v) => a + v[i], 0));

test('chunk bounds cover the vector exactly', () => {
  const b = chunkBounds(10, 4);
  assert.equal(b[0][0], 0);
  assert.equal(b.at(-1)[1], 10);
  assert.ok(b.every((c, i) => i === 0 || c[0] === b[i - 1][1]));
});

test('ring all-reduce gives every worker the exact sum, for awkward sizes', () => {
  for (const [n, len] of [[2, 7], [3, 10], [4, 33], [5, 3], [8, 100]]) {
    const vs = vecs(n, len, n + len), want = trueSum(vs);
    const { result, steps } = ringAllReduce(vs);
    assert.equal(steps.length, 2 * (n - 1));
    for (const r of result) for (let i = 0; i < len; i++) assert.ok(Math.abs(r[i] - want[i]) < 1e-12, `n=${n} len=${len} i=${i}`);
  }
});

test('ring traffic per worker stays flat while server traffic grows with N', () => {
  const a = ringAllReduce(vecs(4, 1000)).bytesPerWorker, b = ringAllReduce(vecs(32, 1000)).bytesPerWorker;
  assert.ok(b / a < 1.3);
  assert.ok(serverAllReduce(vecs(32, 1000)).serverBytes > 7 * serverAllReduce(vecs(4, 1000)).serverBytes);
});

test('server all-reduce is also exact', () => {
  const vs = vecs(5, 20), want = trueSum(vs);
  for (const r of serverAllReduce(vs).result) for (let i = 0; i < 20; i++) assert.ok(Math.abs(r[i] - want[i]) < 1e-12);
});

test('N workers train identically to one: gradients match and replicas never diverge', () => {
  for (const algo of ['ring', 'server']) {
    const t = new Trainer({ workers: 5, batch: 32, algo });
    for (let i = 0; i < 20; i++) {
      const s = t.step();
      assert.ok(s.maxDiff < 1e-10, `${algo} maxDiff ${s.maxDiff}`);
      assert.equal(s.divergence, 0);
    }
  }
});

test('training actually learns', () => {
  const t = new Trainer({ workers: 4, batch: 64 });
  for (let i = 0; i < 400; i++) t.step();
  assert.ok(t.evaluate() > 0.9, `accuracy ${t.evaluate()}`);
});

test('cost model: ring beats parameter server on big models, efficiency falls with N, stragglers hurt', () => {
  const p = { batch: 512, msPerSample: 2, modelMB: 400, bandwidthGBps: 10, latencyMs: 0.05, overlap: 0 };
  assert.ok(stepTime({ ...p, n: 16, algo: 'ring' }).total < stepTime({ ...p, n: 16, algo: 'server' }).total);
  const c = scalingCurve({ ...p, algo: 'ring' });
  assert.equal(c[0].speedup, 1);
  assert.ok(c.at(-1).efficiency < c[1].efficiency);
  assert.ok(stepTime({ ...p, n: 8, algo: 'ring', straggler: 3 }).total > stepTime({ ...p, n: 8, algo: 'ring' }).total);
});
