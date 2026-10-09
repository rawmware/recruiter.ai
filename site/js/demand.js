import { $, h, pct, clear } from './util.js';

export function renderKpis(agg, snapshot) {
  const box = clear($('#kpis'));
  const mode = Object.fromEntries(agg.workMode.map((m) => [m.name, m.share]));
  const kpi = (value, label) => h('div', { class: 'kpi' }, h('b', {}, value), h('span', {}, label));
  box.append(
    kpi(agg.jobs.toLocaleString(), 'open roles in this track'),
    kpi(snapshot.newToday.toLocaleString(), snapshot.firstRun ? 'new since last run (starts tomorrow)' : 'new since the previous run (all tracks)'),
    kpi(agg.years.medianMin == null ? '—' : `${agg.years.medianMin} yrs`, `median minimum experience (${pct(agg.years.statedShare)} state one)`),
    kpi(pct(mode.remote ?? 0), 'fully remote'),
    kpi(agg.salary.medianMin ? `$${Math.round(agg.salary.medianMin / 1000)}k–$${Math.round(agg.salary.medianMax / 1000)}k` : '—', `median listed base pay (${agg.salary.n} roles list one)`),
  );
}

const CATEGORY_ORDER = ['AI & LLM', 'Machine Learning', 'Languages', 'Frameworks & Frontend', 'Cloud & Data', 'Practices & Soft Signals'];

export function renderCategories(agg, { onSkill, limit = 8 }) {
  const box = clear($('#categories'));
  const order = Object.entries(agg.categories)
    .map(([cat, skills]) => ({ cat, skills, weight: skills.reduce((a, s) => a + s.count, 0) }))
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.cat) - CATEGORY_ORDER.indexOf(b.cat));
  for (const { cat, skills } of order) {
    const top = skills.slice(0, limit);
    const max = top[0]?.share || 1;
    box.append(
      h('div', { class: 'cat' }, h('h4', {}, cat),
        top.map((s) => h('div', { class: 'bar', title: `${s.count} postings · click to list them`, onclick: () => onSkill(s.name) },
          h('span', { class: 'name' }, s.name),
          h('span', { class: 'track' }, h('span', { class: 'fill', style: `width:${(s.share / max) * 100}%;display:block` })),
          h('span', { class: 'pct' }, pct(s.share))))),
    );
  }
}

export function renderPairs(agg) {
  const box = clear($('#pairs'));
  for (const p of agg.pairs) box.append(h('span', { class: 'chip' }, p.pair, h('small', {}, `${p.count}`)));
}
