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

export function renderCategories(agg, { onSkill, limit = 8, metric = "share" }) {
  const note = $("#metric-note");
  note.textContent = metric === "required"
    ? `Among the ${pct(agg.sectionedShare)} of postings with a parseable requirements section, how many list the skill there rather than as a nice-to-have.`
    : "Share of postings in this track that mention each skill. Grouped by what kind of ask it is.";
  const box = clear($('#categories'));
  const order = Object.entries(agg.categories)
    .map(([cat, skills]) => ({ cat, skills, weight: skills.reduce((a, s) => a + s.count, 0) }))
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.cat) - CATEGORY_ORDER.indexOf(b.cat));
  for (const { cat, skills } of order) {
    const value = (s) => (metric === "required" ? s.required : s.share);
    const top = [...skills].sort((a, b) => value(b) - value(a)).slice(0, limit);
    const max = value(top[0] ?? { share: 1, required: 1 }) || 1;
    box.append(
      h('div', { class: 'cat' }, h('h4', {}, cat),
        top.map((s) => h('div', { class: 'bar', title: `${s.count} postings mention it · required in ${pct(s.required)} / preferred-only in ${pct(s.preferred)} of postings with a requirements section · click to list them`, onclick: () => onSkill(s.name) },
          h('span', { class: 'name' }, s.name),
          h('span', { class: 'track' }, h('span', { class: 'fill', style: `width:${(value(s) / max) * 100}%;display:block` })),
          h('span', { class: 'pct' }, pct(value(s)))))),
    );
  }
}

export function renderPairs(agg) {
  const box = clear($('#pairs'));
  for (const p of agg.pairs) box.append(h('span', { class: 'chip' }, p.pair, h('small', {}, `${p.count}`)));
}
