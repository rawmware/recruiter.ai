import { $, h, money, clear } from './util.js';

const PAGE = 40;

export function filterJobs(jobs, f) {
  const q = (f.q || '').trim().toLowerCase();
  return jobs.filter((j) => {
    if (f.seniority && j.seniority !== f.seniority) return false;
    if (f.mode && j.workMode !== f.mode) return false;
    if (f.onlyNew && j.firstSeen !== f.today) return false;
    if (f.onlySalary && !j.salary) return false;
    if (q && !`${j.title} ${j.company} ${j.skills.join(' ')} ${j.location}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

export function sortJobs(jobs, today) {
  return [...jobs].sort((a, b) => (b.firstSeen === today) - (a.firstSeen === today) || b.skills.length - a.skills.length || a.company.localeCompare(b.company));
}

export function setupJobs({ getJobs, today }) {
  const state = { q: '', seniority: '', mode: '', onlyNew: false, onlySalary: false, shown: PAGE, today };
  const tbody = $('#table tbody');

  function render() {
    const rows = sortJobs(filterJobs(getJobs(), state), today);
    clear(tbody);
    for (const j of rows.slice(0, state.shown)) {
      tbody.append(h('tr', {},
        h('td', {}, h('a', { href: j.url, target: '_blank', rel: 'noopener noreferrer' }, j.title), j.firstSeen === today ? h('span', { class: 'new' }, 'NEW') : null),
        h('td', {}, j.company), h('td', {}, j.seniority), h('td', {}, j.workMode),
        h('td', {}, j.salary ? `${money(j.salary.min)}–${money(j.salary.max)}` : '—'),
        h('td', {}, j.skills.slice(0, 6).map((s) => h('span', { class: 'tag' }, s)))));
    }
    $('#count').textContent = `${rows.length.toLocaleString()} roles`;
    $('#more').hidden = rows.length <= state.shown;
  }

  const bind = (id, key, ev = 'input', read = (e) => e.target.value) => $(id).addEventListener(ev, (e) => { state[key] = read(e); state.shown = PAGE; render(); });
  bind('#q', 'q');
  bind('#f-seniority', 'seniority', 'change');
  bind('#f-mode', 'mode', 'change');
  bind('#f-new', 'onlyNew', 'change', (e) => e.target.checked);
  bind('#f-salary', 'onlySalary', 'change', (e) => e.target.checked);
  $('#more').addEventListener('click', () => { state.shown += PAGE; render(); });

  return {
    render,
    setQuery(q) { state.q = q; state.shown = PAGE; $('#q').value = q; render(); },
    setSeniorities(list) {
      const sel = $('#f-seniority');
      sel.replaceChildren(h('option', { value: '' }, 'Any seniority'), ...list.map((s) => h('option', { value: s }, s)));
    },
  };
}
