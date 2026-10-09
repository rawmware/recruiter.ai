import { $, h, clear, timeAgo } from './js/util.js';
import { loadAll } from './js/data.js';
import { renderKpis, renderCategories, renderPairs } from './js/demand.js';
import { renderMovers, renderHistory } from './js/movers.js';
import { renderQuotes, renderSignals } from './js/words.js';
import { renderMatch } from './js/match.js';
import { setupJobs } from './js/jobs.js';
import { renderBuilt } from './js/built.js';

const TRACKS = [['all', 'All engineering'], ['ai', 'AI / LLM'], ['ml', 'Machine learning'], ['software', 'Software']];

async function main() {
  let data;
  try {
    data = await loadAll();
  } catch (err) {
    $('#freshness').textContent = 'data unavailable';
    $('#kpis').replaceChildren(h('p', {}, `Could not load data: ${err.message}. Run npm run data to generate it.`));
    return;
  }
  const { latest, history } = data;
  const store = (() => { try { return localStorage; } catch { return { getItem: () => null, setItem() {} }; } })();
  let track = TRACKS.some(([k]) => k === store.getItem('recruiter.ai.track')) ? store.getItem('recruiter.ai.track') : 'all';

  const trackJobs = () => (track === 'all' ? latest.jobs : latest.jobs.filter((j) => j.track === track));
  const jobsUi = setupJobs({ getJobs: trackJobs, today: latest.firstRun ? null : latest.date });
  const agg = () => latest.aggregate.tracks[track];

  function renderAll() {
    renderKpis(agg(), latest);
    renderCategories(agg(), { onSkill: (name) => { jobsUi.setQuery(name); $('#jobs').scrollIntoView(); } });
    renderPairs(agg());
    renderMovers(latest, track);
    renderHistory(history, track);
    renderQuotes(trackJobs());
    renderSignals(agg());
    renderMatch(agg(), trackJobs(), renderAll);
    jobsUi.setSeniorities(agg().seniority.map((s) => s.name));
    jobsUi.render();
  }

  const tabs = clear($('#track-tabs'));
  for (const [key, label] of TRACKS) {
    const t = h('button', { class: 'tab', role: 'tab', 'aria-selected': String(key === track), 'data-key': key }, `${label} `, h('span', { class: 'muted' }, latest.aggregate.tracks[key].jobs.toLocaleString()));
    t.addEventListener('click', () => {
      track = key;
      store.setItem('recruiter.ai.track', key);
      tabs.querySelectorAll('.tab').forEach((x) => x.setAttribute('aria-selected', String(x.dataset.key === key)));
      renderAll();
    });
    tabs.append(t);
  }

  $('#shuffle').addEventListener('click', () => renderQuotes(trackJobs()));
  $('#hero-date').textContent = new Date(`${latest.date}T00:00:00Z`).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  $('#freshness').replaceChildren('updated ', h('b', {}, timeAgo(latest.generatedAt)), ` · ${latest.aggregate.total.toLocaleString()} roles`);
  renderBuilt(data);
  renderAll();
}

main();
