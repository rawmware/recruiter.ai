import { $, h, pct, clear } from './util.js';

const LABELS = {
  degree: { 'or-equivalent': 'Degree or equivalent experience', 'not-required': 'No degree required', phd: 'PhD asked for', degree: "Bachelor's/Master's stated", unspecified: 'Degree not mentioned' },
  sponsorship: { yes: 'Sponsorship/relocation offered', no: 'No sponsorship', unspecified: 'Not mentioned' },
};

export function sampleQuotes(jobs, n = 5, rand = Math.random) {
  const pool = jobs.filter((j) => j.asks?.length);
  const out = [];
  const used = new Set();
  while (out.length < Math.min(n, pool.length)) {
    const j = pool[Math.floor(rand() * pool.length)];
    if (used.has(j.id)) continue;
    used.add(j.id);
    const ask = j.asks[Math.floor(rand() * j.asks.length)].replace(/^-\s*/, '');
    out.push({ ask, job: j });
  }
  return out;
}

export function renderQuotes(jobs) {
  const box = clear($('#quotes'));
  for (const { ask, job } of sampleQuotes(jobs)) {
    box.append(h('li', {}, `“${ask}”`, h('small', {}, job.company, ' · ', h('a', { href: job.url, target: '_blank', rel: 'noopener noreferrer' }, job.title))));
  }
  if (!box.children.length) box.append(h('li', {}, 'No quotable requirement lines in this track yet.'));
}

function table(title, rows, labels = {}) {
  return h('div', {}, h('h3', {}, title),
    h('ul', { class: 'mv' }, rows.map((r) => h('li', {}, h('span', {}, labels[r.name] ?? r.name), h('span', { class: 'muted' }, `${pct(r.share)} · ${r.count}`)))));
}

export function renderSignals(agg) {
  const box = clear($('#signals'));
  box.append(table('Seniority mix', agg.seniority), table('Degree expectations', agg.degree, LABELS.degree), table('Visa sponsorship', agg.sponsorship, LABELS.sponsorship), table('Where the roles are', agg.metros ?? []), table('Who is hiring most', agg.topCompanies.slice(0, 8)));
}
