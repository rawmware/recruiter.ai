import { $, h, pct, clear } from './util.js';

const SVG = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};

function list(rows, cls) {
  if (!rows.length) return h('p', { class: 'muted' }, 'Nothing moved enough yet.');
  return h('ul', { class: 'mv' }, rows.map((r) => h('li', {}, h('span', {}, r.name),
    h('span', { class: cls }, `${r.delta > 0 ? '+' : ''}${(r.delta * 100).toFixed(1)} pts · now ${pct(r.share)}`))));
}

export function renderMovers(snapshot, track) {
  const sub = $('#movers-sub');
  const grid = clear($('#movers-grid'));
  const m = snapshot.movers?.[track];
  if (!snapshot.baselineDate || !m) {
    sub.textContent = 'Movers compare today with a snapshot from up to a week ago. The first run has no baseline, so this fills in from tomorrow.';
    return;
  }
  sub.textContent = `Change in the share of postings mentioning each skill since ${snapshot.baselineDate}.`;
  grid.append(h('div', {}, h('h3', {}, 'Rising'), list(m.rising, 'up')), h('div', {}, h('h3', {}, 'Fading'), list(m.falling, 'down')));
}

// A tiny dependency-free line chart: total target roles per day for the selected track.
export function renderHistory(history, track) {
  const box = clear($('#history'));
  const pts = history.map((d) => ({ date: d.date, v: d.aggregate.tracks[track]?.jobs ?? 0 }));
  if (pts.length < 2) {
    box.append(h('p', { class: 'muted' }, `History: ${pts.length} day recorded. A trend line appears once there are two.`));
    return;
  }
  const W = 640, H = 120, pad = 24;
  const max = Math.max(...pts.map((p) => p.v)), min = Math.min(...pts.map((p) => p.v));
  const x = (i) => pad + (i * (W - 2 * pad)) / (pts.length - 1);
  const y = (v) => H - pad - ((v - min) / Math.max(1, max - min)) * (H - 2 * pad);
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': `Open roles per day, ${pts[0].date} to ${pts.at(-1).date}` });
  svg.append(s('polyline', { points: pts.map((p, i) => `${x(i)},${y(p.v)}`).join(' '), fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2 }));
  pts.forEach((p, i) => { const c = s('circle', { cx: x(i), cy: y(p.v), r: 3, fill: 'var(--accent)' }); const t = s('title'); t.textContent = `${p.date}: ${p.v}`; c.append(t); svg.append(c); });
  box.append(h('h3', {}, 'Open target roles per day'), svg);
}
