import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../site/labs/gradient-ring/js/rng.js';
import { makeDataset } from '../site/labs/gradient-ring/js/data.js';
import { makeLayout, initParams, gradSum } from '../site/labs/gradient-ring/js/mlp.js';

const setup = () => {
  const layout = makeLayout([2, 6, 6, 1]);
  const p = initParams(layout, makeRng(3));
  const ds = makeDataset('moons', 40, 5);
  return { layout, p, ds };
};

test('rng is deterministic', () => {
  assert.equal(makeRng(9)(), makeRng(9)());
});

test('analytic gradient matches numeric gradient', () => {
  const { layout, p, ds } = setup();
  const idxs = [...Array(10).keys()];
  const g = new Float64Array(layout.size);
  gradSum(layout, p, ds.X, ds.y, idxs, g);
  const lossAt = (q) => gradSum(layout, q, ds.X, ds.y, idxs, new Float64Array(layout.size)).loss;
  for (const i of [0, 7, 20, layout.size - 1]) {
    const h = 1e-6, a = Float64Array.from(p), b = Float64Array.from(p);
    a[i] += h; b[i] -= h;
    const numeric = (lossAt(a) - lossAt(b)) / (2 * h);
    assert.ok(Math.abs(numeric - g[i]) < 1e-5, `param ${i}: ${numeric} vs ${g[i]}`);
  }
});

test('gradient of a batch equals the sum of gradients of its shards', () => {
  const { layout, p, ds } = setup();
  const all = [...Array(24).keys()];
  const full = new Float64Array(layout.size);
  gradSum(layout, p, ds.X, ds.y, all, full);
  const parts = [all.slice(0, 8), all.slice(8, 16), all.slice(16)].map((ix) => {
    const g = new Float64Array(layout.size); gradSum(layout, p, ds.X, ds.y, ix, g); return g;
  });
  for (let i = 0; i < layout.size; i++) assert.ok(Math.abs(full[i] - (parts[0][i] + parts[1][i] + parts[2][i])) < 1e-12);
});
