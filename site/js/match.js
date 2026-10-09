import { $, h, pct, clear, safeStore } from './util.js';

const KEY = 'recruiter.ai.profile.v1';
const store = safeStore();

export function loadProfile() {
  try { return new Set(JSON.parse(store.getItem(KEY) || '[]')); } catch { return new Set(); }
}
const saveProfile = (set) => store.setItem(KEY, JSON.stringify([...set]));

// Fraction of a role's ask that the candidate covers. Roles with <3 detected skills are too sparse to rank.
export function matchScore(job, mine) {
  if (!job.skills || job.skills.length < 3) return 0;
  return job.skills.filter((s) => mine.has(s)).length / job.skills.length;
}

export function bestFit(jobs, mine, n = 10) {
  return jobs.map((j) => ({ j, score: matchScore(j, mine) })).filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.j.skills.length - a.j.skills.length).slice(0, n);
}

export function gaps(agg, mine, n = 10) {
  return agg.skills.filter((s) => !mine.has(s.name)).slice(0, n);
}

export function renderMatch(agg, jobs, rerender = () => {}) {
  const mine = loadProfile();
  const picker = clear($('#profile'));
  for (const s of agg.skills.slice(0, 45)) {
    const chip = h('span', { class: `chip${mine.has(s.name) ? ' on' : ''}`, role: 'checkbox', tabindex: 0, 'aria-checked': String(mine.has(s.name)) }, s.name, h('small', {}, pct(s.share)));
    const toggle = () => { mine.has(s.name) ? mine.delete(s.name) : mine.add(s.name); saveProfile(mine); rerender(); };
    chip.addEventListener('click', toggle);
    chip.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); } });
    picker.append(chip);
  }
  const best = clear($('#best'));
  const rows = bestFit(jobs, mine);
  if (!mine.size) best.append(h('li', {}, 'Tick a few skills above to rank roles.'));
  for (const { j, score } of rows) best.append(h('li', {}, h('a', { href: j.url, target: '_blank', rel: 'noopener noreferrer' }, `${j.title} — ${j.company}`), h('span', { class: 'score' }, pct(score))));
  const gapList = clear($('#gaps'));
  for (const g of gaps(agg, mine)) gapList.append(h('li', {}, g.name, h('span', { class: 'score' }, pct(g.share))));
}
