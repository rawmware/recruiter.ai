import { makeRng } from './rng.js';

// Three 2-D binary classification sets with increasing difficulty.
export const DATASETS = {
  moons: 'Two moons',
  spiral: 'Spiral',
  rings: 'Concentric rings',
};

export function makeDataset(kind, n = 400, seed = 7, noise = 0.08) {
  const rnd = makeRng(seed);
  const X = new Float64Array(n * 2);
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const c = i % 2;
    const t = rnd();
    let px, py;
    if (kind === 'spiral') {
      const r = 0.1 + t * 0.9, a = t * 3.2 * Math.PI + c * Math.PI;
      px = r * Math.cos(a); py = r * Math.sin(a);
    } else if (kind === 'rings') {
      const r = c ? 0.9 : 0.4, a = t * 2 * Math.PI;
      px = r * Math.cos(a); py = r * Math.sin(a);
    } else {
      const a = t * Math.PI;
      px = c ? 0.5 - Math.cos(a) * 0.8 + 0.25 : Math.cos(a) * 0.8 - 0.25;
      py = c ? 0.2 - Math.sin(a) * 0.8 : Math.sin(a) * 0.8 - 0.1;
    }
    X[2 * i] = px + rnd.normal() * noise;
    X[2 * i + 1] = py + rnd.normal() * noise;
    y[i] = c;
  }
  return { X, y, n, kind };
}
