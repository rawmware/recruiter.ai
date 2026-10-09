async function getJson(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

export async function loadAll() {
  const latest = await getJson('data/latest.json');
  const index = await getJson('data/index.json').catch(() => ({ dates: [latest.date] }));
  // History is small (aggregates only); load the most recent 30 days for the sparkline.
  const recent = index.dates.slice(-30);
  const history = (await Promise.all(recent.map((d) => getJson(`data/history/${d}.json`).catch(() => null)))).filter(Boolean);
  const buildlog = await getJson('data/buildlog.json').catch(() => null);
  return { latest, history, buildlog };
}
