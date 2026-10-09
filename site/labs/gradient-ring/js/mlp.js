// A tiny multilayer perceptron with a flat parameter vector, so "the gradient"
// is one array that workers can exchange. tanh hidden layers, sigmoid output, cross-entropy loss.
export function makeLayout(sizes) {
  let off = 0;
  const layers = [];
  for (let i = 0; i < sizes.length - 1; i++) {
    const nin = sizes[i], nout = sizes[i + 1];
    layers.push({ nin, nout, w: off, b: off + nin * nout });
    off += nin * nout + nout;
  }
  return { sizes, layers, size: off };
}

export function initParams(layout, rnd) {
  const p = new Float64Array(layout.size);
  for (const L of layout.layers) {
    const s = Math.sqrt(2 / (L.nin + L.nout));
    for (let i = 0; i < L.nin * L.nout; i++) p[L.w + i] = rnd.normal() * s;
  }
  return p;
}

const sigmoid = (z) => 1 / (1 + Math.exp(-z));

function forward(layout, p, x0, x1, acts) {
  acts[0][0] = x0; acts[0][1] = x1;
  const last = layout.layers.length - 1;
  layout.layers.forEach((L, li) => {
    const a = acts[li], out = acts[li + 1];
    for (let o = 0; o < L.nout; o++) {
      let z = p[L.b + o];
      for (let i = 0; i < L.nin; i++) z += p[L.w + o * L.nin + i] * a[i];
      out[o] = li === last ? z : Math.tanh(z);
    }
  });
  return acts[last + 1][0];
}

export const makeActs = (layout) => layout.sizes.map((n) => new Float64Array(n));

export function predict(layout, p, x0, x1, acts = makeActs(layout)) {
  return sigmoid(forward(layout, p, x0, x1, acts));
}

// Accumulate the SUM of per-sample gradients for the given sample indices into `grad`.
// Summing (not averaging) is what lets shards combine exactly: sum of sums = sum over the whole batch.
export function gradSum(layout, p, X, y, idxs, grad) {
  const acts = makeActs(layout);
  const deltas = layout.sizes.map((n) => new Float64Array(n));
  const last = layout.layers.length - 1;
  let loss = 0, correct = 0;
  for (const s of idxs) {
    const z = forward(layout, p, X[2 * s], X[2 * s + 1], acts);
    const pr = sigmoid(z), t = y[s];
    const eps = 1e-12;
    loss += -(t * Math.log(pr + eps) + (1 - t) * Math.log(1 - pr + eps));
    if ((pr > 0.5) === (t === 1)) correct++;
    deltas[last + 1][0] = pr - t;
    for (let li = last; li >= 0; li--) {
      const L = layout.layers[li], a = acts[li], d = deltas[li + 1], dprev = deltas[li];
      dprev.fill(0);
      for (let o = 0; o < L.nout; o++) {
        grad[L.b + o] += d[o];
        for (let i = 0; i < L.nin; i++) {
          grad[L.w + o * L.nin + i] += d[o] * a[i];
          dprev[i] += d[o] * p[L.w + o * L.nin + i];
        }
      }
      if (li > 0) for (let i = 0; i < L.nin; i++) dprev[i] *= 1 - a[i] * a[i];
    }
  }
  return { loss, correct };
}
