import { Trainer } from './trainer.js';
import { stepTime, scalingCurve } from './costmodel.js';
import { drawModel, drawRing, drawLoss, drawScale, drawBreakdown } from './charts.js';

const $ = (id) => document.getElementById(id);
const ctx = { model: $('cv-model').getContext('2d'), ring: $('cv-ring').getContext('2d'), loss: $('cv-loss').getContext('2d'), scale: $('cv-scale').getContext('2d'), brk: $('cv-break').getContext('2d') };

const state = { trainer: null, playing: false, speed: 'normal', algo: 'ring', owners: new Map(), anim: null, last: null, acc: 0, frame: 0 };
const TOTAL_MS = { slow: 3600, normal: 1500 };

const val = (id) => Number($(id).value);
const cfg = () => ({ workers: val('workers'), batch: val('batch'), lr: val('lr'), dataset: $('dataset').value, algo: state.algo });
const hw = () => ({ batch: val('batch'), msPerSample: val('cpu'), modelMB: val('model'), bandwidthGBps: val('bw'), latencyMs: val('lat'), overlap: val('ov') / 100, straggler: val('strag') });

const identity = (n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, c) => (i === c ? 1 : 0)));
const ring = { n: 4, algo: 'ring', contrib: identity(4), transfers: null, t: 0, phase: 'ready' };

function reset() {
  const c = cfg();
  state.trainer = new Trainer(c);
  state.owners = new Map();
  state.anim = null;
  state.last = null;
  ring.n = c.workers; ring.algo = c.algo; ring.contrib = identity(c.workers); ring.transfers = null; ring.phase = c.workers === 1 ? 'one worker: nothing to synchronise' : 'ready';
  $('p-diff').textContent = $('p-div').textContent = $('p-acc').textContent = '—';
  refreshModel(); refreshLoss(); refreshMetrics();
}

function startAnim(steps) {
  const n = ring.n;
  ring.contrib = identity(n);
  if (!steps.length) { state.anim = null; return; }
  state.anim = { steps, idx: 0, start: performance.now(), dur: Math.max(60, TOTAL_MS[state.speed] / steps.length) };
}

function applyStep(step) {
  const { contrib } = ring;
  if (ring.algo !== 'ring') return;
  const snap = contrib.map((r) => r.slice());
  for (const m of step.transfers) {
    if (step.phase === 'scatter-reduce') contrib[m.to][m.chunk] += snap[m.from][m.chunk];
    else contrib[m.to][m.chunk] = snap[m.from][m.chunk];
  }
}

function advanceAnim(now) {
  const a = state.anim;
  if (!a) { ring.transfers = null; return; }
  let t = (now - a.start) / a.dur;
  while (t >= 1 && a.idx < a.steps.length) {
    applyStep(a.steps[a.idx]);
    a.idx++; a.start += a.dur; t = (now - a.start) / a.dur;
  }
  if (a.idx >= a.steps.length) {
    state.anim = null; ring.transfers = null;
    ring.phase = 'synchronised ✓ every worker holds the same summed gradient';
    if (ring.algo === 'ring') ring.contrib = ring.contrib.map((r) => r.map(() => ring.n));
    return;
  }
  const s = a.steps[a.idx];
  ring.transfers = s.transfers; ring.t = Math.max(0, t);
  ring.phase = `${s.phase} · hop ${a.idx + 1}/${a.steps.length}`;
}

function doStep(animate) {
  const r = state.trainer.step();
  state.last = r;
  state.owners = new Map();
  r.shards.forEach((ix, w) => ix.forEach((i) => state.owners.set(i, w)));
  if (animate) startAnim(r.comm.steps);
  return r;
}

function fmtMB(mb) { return mb >= 1000 ? `${(mb / 1000).toFixed(1)} GB` : `${mb.toFixed(0)} MB`; }
function fmtSci(x) { return x === 0 ? '0' : x.toExponential(1); }

function refreshMetrics() {
  const r = state.last, n = ring.n, p = hw();
  const t = stepTime({ ...p, n, algo: state.algo }), t1 = stepTime({ ...p, n: 1 });
  const speedup = t1.total / t.total;
  const traffic = state.algo === 'ring' ? (n > 1 ? (2 * (n - 1) / n) * p.modelMB : 0) : (n > 1 ? 2 * n * p.modelMB : 0);
  const items = [
    ['Step', r ? r.step : 0, ''],
    ['Loss', r ? r.loss.toFixed(3) : '—', ''],
    ['Batch accuracy', r ? `${(r.acc * 100).toFixed(0)}%` : '—', ''],
    ['Modeled step time', `${t.total.toFixed(1)} ms`, ''],
    ['Speed-up vs 1 machine', `${speedup.toFixed(2)}×`, speedup / n > 0.75 ? 'var(--green)' : speedup / n > 0.4 ? 'var(--amber)' : 'var(--pink)'],
    ['Efficiency', `${((speedup / n) * 100).toFixed(0)}%`, ''],
    [state.algo === 'ring' ? 'Traffic per worker' : 'Server link traffic', fmtMB(traffic), ''],
  ];
  $('metrics').replaceChildren(...items.map(([label, value, color]) => {
    const d = document.createElement('div'); d.className = 'm';
    const b = document.createElement('b'); b.textContent = value; if (color) b.style.color = color;
    const s = document.createElement('span'); s.textContent = label;
    d.append(b, s); return d;
  }));
  if (r) {
    $('p-diff').textContent = fmtSci(r.maxDiff);
    $('p-div').textContent = r.divergence === 0 ? 'exactly 0' : fmtSci(r.divergence);
    if (r.step % 5 === 0 || r.step < 3) $('p-acc').textContent = `${(state.trainer.evaluate() * 100).toFixed(1)}%`;
  }
}

const refreshModel = () => { drawModel(ctx.model, state.trainer, state.owners, ring.n); $('phase-model').textContent = state.last ? `step ${state.last.step}` : ''; };
const refreshLoss = () => drawLoss(ctx.loss, state.trainer.history);

function refreshScale() {
  const p = hw();
  const ringRows = scalingCurve({ ...p, algo: 'ring' }), serverRows = scalingCurve({ ...p, algo: 'server' });
  drawScale(ctx.scale, ringRows, serverRows);
  const rows = state.algo === 'ring' ? ringRows : serverRows;
  drawBreakdown(ctx.brk, rows, ring.n);

  const best = (rs) => rs.reduce((a, b) => (b.speedup > a.speedup ? b : a));
  const bR = best(ringRows), bS = best(serverRows);
  const cur = stepTime({ ...p, n: ring.n, algo: state.algo });
  const bound = cur.exposed > cur.compute ? 'communication-bound' : 'compute-bound';
  const el = $('insight'); el.replaceChildren();
  const add = (txt, bold) => { if (bold) { const b = document.createElement('b'); b.textContent = txt; el.append(b); } else el.append(document.createTextNode(txt)); };
  add(`With ${ring.n} worker${ring.n === 1 ? '' : 's'} using the ${state.algo === 'ring' ? 'ring' : 'parameter server'}, a step is `);
  add(bound, true);
  add(` (${cur.compute.toFixed(0)} ms compute, ${cur.exposed.toFixed(0)} ms exposed communication). The ring peaks at `);
  add(`${bR.speedup.toFixed(1)}× around ${bR.n} workers`, true);
  add(`; the parameter server `);
  add(bS.n === 1 ? `never beats 1 machine` : `peaks at ${bS.speedup.toFixed(1)}× around ${bS.n}`, true);
  add(`. ${bS.n === 1 ? 'The server never beats a single machine here: its link carries N full copies. ' : ''}Past the peak, extra machines mostly buy you waiting.`);
}

function tick(now) {
  state.frame++;
  if (state.playing) {
    if (state.speed === 'turbo') {
      for (let i = 0; i < 12; i++) doStep(false);
      ring.transfers = null; ring.phase = 'turbo: communication not animated'; ring.contrib = ring.contrib.map((r) => r.map(() => ring.n));
      refreshMetrics(); refreshLoss();
    } else if (!state.anim) {
      doStep(true); refreshMetrics(); refreshLoss();
    }
  }
  advanceAnim(now);
  drawRing(ctx.ring, ring);
  $('phase-ring').textContent = ring.phase.split(' · ')[0].split(' every')[0];
  if (state.frame % 3 === 0 || (state.playing && state.speed === 'turbo')) refreshModel();
}

function loop(now) {
  if (!document.hidden) tick(now);
  requestAnimationFrame(loop);
}
// Browsers pause animation frames in background tabs; keep training alive at a slower cadence.
setInterval(() => { if (document.hidden) tick(performance.now()); }, 100);

// ---- wiring ----
const outputs = {
  workers: (v) => v, batch: (v) => v, lr: (v) => v, model: (v) => `${v} MB`, bw: (v) => `${v} GB/s`, lat: (v) => `${v} ms`, cpu: (v) => `${v} ms`, ov: (v) => `${v}%`, strag: (v) => `${Number(v).toFixed(1)}×`,
};
const outId = { workers: 'o-workers', batch: 'o-batch', lr: 'o-lr', model: 'o-model', bw: 'o-bw', lat: 'o-lat', cpu: 'o-cpu', ov: 'o-ov', strag: 'o-strag' };
for (const id of Object.keys(outputs)) {
  const el = $(id);
  const sync = () => { $(outId[id]).textContent = outputs[id](el.value); };
  el.addEventListener('input', () => {
    sync();
    if (id === 'workers') reset();
    if (id === 'batch') state.trainer.cfg.batch = val('batch');
    if (id === 'lr') state.trainer.cfg.lr = val('lr');
    refreshMetrics(); refreshScale();
  });
  sync();
}
$('dataset').addEventListener('change', reset);

document.querySelectorAll('[data-algo]').forEach((b) => b.addEventListener('click', () => {
  state.algo = b.dataset.algo;
  document.querySelectorAll('[data-algo]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  state.trainer.cfg.algo = state.algo; ring.algo = state.algo; state.anim = null; ring.transfers = null; ring.contrib = identity(ring.n);
  refreshMetrics(); refreshScale();
}));
document.querySelectorAll('[data-speed]').forEach((b) => b.addEventListener('click', () => {
  state.speed = b.dataset.speed;
  document.querySelectorAll('[data-speed]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
}));
const setPlaying = (on) => { state.playing = on; $('play').textContent = on ? '⏸ Pause' : '▶ Train'; };
$('play').addEventListener('click', () => setPlaying(!state.playing));
$('step').addEventListener('click', () => { setPlaying(false); if (!state.anim) { doStep(true); refreshMetrics(); refreshLoss(); } });
$('reset').addEventListener('click', () => { reset(); refreshScale(); });

reset();
refreshScale();
if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
  // Respect reduced motion: train fast with no flying packets.
  state.speed = 'turbo';
  document.querySelectorAll('[data-speed]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.speed === 'turbo')));
}
setPlaying(true);
requestAnimationFrame(loop);
