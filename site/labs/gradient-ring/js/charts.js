// Canvas renderers. Pure drawing: they take state and paint, nothing here mutates the model.
export const CYAN = '#22d3ee', PINK = '#f472b6', VIOLET = '#a78bfa', AMBER = '#fbbf24', GREY = '#6b7099';
export const workerColor = (i, n) => `hsl(${Math.round((i / Math.max(1, n)) * 300 + 170) % 360} 90% 65%)`;
const chunkColor = (c, n, a = 1) => `hsl(${Math.round((c / Math.max(1, n)) * 300 + 170) % 360} 95% 62% / ${a})`;

const WORLD = { x0: -1.5, x1: 1.9, y0: -1.4, y1: 1.35 };
const toPx = (w, h) => (x, y) => [((x - WORLD.x0) / (WORLD.x1 - WORLD.x0)) * w, h - ((y - WORLD.y0) / (WORLD.y1 - WORLD.y0)) * h];

let off;
export function drawModel(ctx, trainer, owners, n) {
  const { width: W, height: H } = ctx.canvas;
  const GW = 56, GH = 46;
  off ??= Object.assign(document.createElement('canvas'), { width: GW, height: GH });
  const octx = off.getContext('2d');
  const img = octx.createImageData(GW, GH);
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const x = WORLD.x0 + ((i + 0.5) / GW) * (WORLD.x1 - WORLD.x0);
    const y = WORLD.y1 - ((j + 0.5) / GH) * (WORLD.y1 - WORLD.y0);
    const p = trainer.prob(x, y), k = (j * GW + i) * 4;
    const conf = Math.abs(p - 0.5) * 2;
    // class 1 -> pink, class 0 -> cyan, fading to near-black at the decision boundary
    const [r, g, b] = p > 0.5 ? [244, 114, 182] : [34, 211, 238];
    img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = 18 + conf * 95;
  }
  octx.putImageData(img, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(off, 0, 0, W, H);
  const px = toPx(W, H), { X, y, n: count } = trainer.data;
  for (let i = 0; i < count; i++) {
    const [cx, cy] = px(X[2 * i], X[2 * i + 1]);
    const w = owners.get(i);
    ctx.beginPath();
    ctx.arc(cx, cy, w == null ? 3.2 : 4.6, 0, Math.PI * 2);
    ctx.fillStyle = y[i] ? PINK : CYAN;
    ctx.globalAlpha = w == null ? 0.55 : 1;
    ctx.fill();
    if (w != null) { ctx.lineWidth = 2; ctx.strokeStyle = workerColor(w, n); ctx.stroke(); }
  }
  ctx.globalAlpha = 1;
}

export function ringLayout(n, algo, W, H) {
  const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.34;
  const pos = Array.from({ length: n }, (_, i) => { const a = -Math.PI / 2 + (i / n) * Math.PI * 2; return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; });
  return { cx, cy, R, pos, hub: algo === 'server' ? [cx, cy] : null };
}

// contrib[i][c] = how many workers' contributions chunk c currently holds on node i.
export function drawRing(ctx, { n, algo, contrib, transfers, t, phase }) {
  const { width: W, height: H } = ctx.canvas;
  ctx.clearRect(0, 0, W, H);
  const L = ringLayout(n, algo, W, H);
  const nodeR = Math.max(13, Math.min(26, 120 / n + 8));

  // links
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(148,163,255,.22)';
  if (algo === 'ring' && n > 1) {
    ctx.beginPath();
    L.pos.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.stroke();
  } else if (L.hub) {
    for (const [x, y] of L.pos) { ctx.beginPath(); ctx.moveTo(L.hub[0], L.hub[1]); ctx.lineTo(x, y); ctx.stroke(); }
  }

  // hub
  if (L.hub) {
    const g = ctx.createRadialGradient(L.hub[0], L.hub[1], 4, L.hub[0], L.hub[1], 44);
    g.addColorStop(0, 'rgba(244,114,182,.9)'); g.addColorStop(1, 'rgba(244,114,182,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(L.hub[0], L.hub[1], 44, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '600 11px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillText('SERVER', L.hub[0], L.hub[1] + 4);
  }

  // nodes with per-chunk fill arcs
  L.pos.forEach(([x, y], i) => {
    ctx.beginPath(); ctx.arc(x, y, nodeR, 0, Math.PI * 2); ctx.fillStyle = '#0b0e22'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = workerColor(i, n); ctx.stroke();
    if (algo === 'ring' && n > 1 && contrib) {
      for (let c = 0; c < n; c++) {
        const a0 = -Math.PI / 2 + (c / n) * Math.PI * 2 + 0.03, a1 = -Math.PI / 2 + ((c + 1) / n) * Math.PI * 2 - 0.03;
        ctx.beginPath(); ctx.arc(x, y, nodeR + 6, a0, a1);
        ctx.lineWidth = 4; ctx.strokeStyle = chunkColor(c, n, 0.15 + 0.85 * (contrib[i][c] / n)); ctx.stroke();
      }
    }
    ctx.fillStyle = '#e8ebff'; ctx.font = `600 ${nodeR > 16 ? 12 : 10}px ui-monospace, monospace`; ctx.textAlign = 'center'; ctx.fillText(`W${i}`, x, y + 4);
  });

  // packets in flight
  if (transfers) {
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    for (const m of transfers) {
      const a = m.from < 0 ? L.hub : L.pos[m.from], b = m.to < 0 ? L.hub : L.pos[m.to];
      const x = a[0] + (b[0] - a[0]) * e, y = a[1] + (b[1] - a[1]) * e;
      const col = chunkColor(m.chunk, n);
      ctx.strokeStyle = chunkColor(m.chunk, n, 0.5); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(a[0] + (b[0] - a[0]) * Math.max(0, e - 0.18), a[1] + (b[1] - a[1]) * Math.max(0, e - 0.18)); ctx.lineTo(x, y); ctx.stroke();
      ctx.shadowColor = col; ctx.shadowBlur = 16; ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    }
  }
  ctx.fillStyle = '#8b90b8'; ctx.font = '11px ui-monospace, monospace'; ctx.textAlign = 'center';
  ctx.fillText(phase || (n === 1 ? 'one worker: nothing to synchronise' : 'ready'), W / 2, H - 14);
}

function axes(ctx, W, H, pad) {
  ctx.strokeStyle = 'rgba(148,163,255,.18)'; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) { const y = pad.t + ((H - pad.t - pad.b) * i) / 4; ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke(); }
}

export function drawLoss(ctx, history) {
  const { width: W, height: H } = ctx.canvas, pad = { l: 38, r: 12, t: 10, b: 18 };
  ctx.clearRect(0, 0, W, H); axes(ctx, W, H, pad);
  if (history.length < 2) { ctx.fillStyle = '#8b90b8'; ctx.font = '13px system-ui'; ctx.fillText('Press Train to see the loss fall.', pad.l + 10, H / 2); return; }
  const pts = history.length > 500 ? history.filter((_, i) => i % Math.ceil(history.length / 500) === 0) : history;
  const maxL = Math.max(0.8, ...pts.map((p) => p.loss));
  const x = (i) => pad.l + (i / (pts.length - 1)) * (W - pad.l - pad.r);
  const line = (fn, col, w = 2.2) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(x(i), fn(p)) : ctx.moveTo(x(i), fn(p)))); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.shadowColor = col; ctx.shadowBlur = 10; ctx.stroke(); ctx.shadowBlur = 0; };
  line((p) => H - pad.b - (p.loss / maxL) * (H - pad.t - pad.b), VIOLET);
  line((p) => H - pad.b - p.acc * (H - pad.t - pad.b), CYAN, 1.6);
  ctx.fillStyle = '#8b90b8'; ctx.font = '11px ui-monospace, monospace'; ctx.textAlign = 'left';
  ctx.fillText(`loss ${maxL.toFixed(2)}`, 2, pad.t + 8); ctx.fillText('0', 12, H - pad.b);
  ctx.fillStyle = VIOLET; ctx.fillText('— loss', W - 130, 14); ctx.fillStyle = CYAN; ctx.fillText('— accuracy', W - 70, 14);
}

const NS = [1, 2, 4, 8, 16, 32, 64];
export function drawScale(ctx, ring, server) {
  const { width: W, height: H } = ctx.canvas, pad = { l: 44, r: 16, t: 14, b: 30 };
  ctx.clearRect(0, 0, W, H); axes(ctx, W, H, pad);
  const maxY = Math.max(...ring.map((r) => r.speedup), ...server.map((r) => r.speedup), 2, ...NS.map((n) => n)) ;
  const ymax = Math.min(64, maxY), X = (i) => pad.l + (i / (NS.length - 1)) * (W - pad.l - pad.r), Y = (v) => H - pad.b - (Math.min(v, ymax) / ymax) * (H - pad.t - pad.b);
  const plot = (rows, col, dash = []) => { ctx.setLineDash(dash); ctx.beginPath(); rows.forEach((r, i) => (i ? ctx.lineTo(X(i), Y(r.speedup)) : ctx.moveTo(X(i), Y(r.speedup)))); ctx.strokeStyle = col; ctx.lineWidth = 2.6; ctx.shadowColor = col; ctx.shadowBlur = dash.length ? 0 : 12; ctx.stroke(); ctx.shadowBlur = 0; ctx.setLineDash([]); rows.forEach((r, i) => { ctx.beginPath(); ctx.arc(X(i), Y(r.speedup), 3.4, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill(); }); };
  plot(NS.map((n) => ({ speedup: n })), GREY, [6, 5]);
  plot(server, PINK); plot(ring, CYAN);
  ctx.fillStyle = '#8b90b8'; ctx.font = '11px ui-monospace, monospace'; ctx.textAlign = 'center';
  NS.forEach((n, i) => ctx.fillText(String(n), X(i), H - 10));
  ctx.textAlign = 'right'; for (let i = 0; i <= 4; i++) ctx.fillText(`${((ymax * (4 - i)) / 4).toFixed(0)}×`, pad.l - 6, pad.t + ((H - pad.t - pad.b) * i) / 4 + 4);
}

export function drawBreakdown(ctx, rows, currentN) {
  const { width: W, height: H } = ctx.canvas, pad = { l: 56, r: 16, t: 14, b: 30 };
  ctx.clearRect(0, 0, W, H); axes(ctx, W, H, pad);
  const max = Math.max(...rows.map((r) => r.compute + r.exposed));
  const bw = ((W - pad.l - pad.r) / rows.length) * 0.62, step = (W - pad.l - pad.r) / rows.length;
  rows.forEach((r, i) => {
    const x = pad.l + i * step + (step - bw) / 2, h = (v) => (v / max) * (H - pad.t - pad.b);
    const hc = h(r.compute), hm = h(r.exposed), base = H - pad.b;
    ctx.fillStyle = CYAN; ctx.shadowColor = CYAN; ctx.shadowBlur = 8; ctx.fillRect(x, base - hc, bw, hc);
    ctx.fillStyle = AMBER; ctx.shadowColor = AMBER; ctx.fillRect(x, base - hc - hm, bw, hm); ctx.shadowBlur = 0;
    if (r.n === currentN) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(x - 3, base - hc - hm - 3, bw + 6, hc + hm + 3); }
    ctx.fillStyle = '#8b90b8'; ctx.font = '11px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillText(String(r.n), x + bw / 2, H - 10);
  });
  ctx.textAlign = 'right'; ctx.fillStyle = '#8b90b8';
  for (let i = 0; i <= 4; i++) ctx.fillText(`${((max * (4 - i)) / 4).toFixed(0)} ms`, pad.l - 6, pad.t + ((H - pad.t - pad.b) * i) / 4 + 4);
}
