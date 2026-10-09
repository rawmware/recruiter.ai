// Daily pipeline: fetch -> classify/enrich -> aggregate -> write dated snapshots.
//   node pipeline/run.mjs [--out site/data] [--date YYYY-MM-DD] [--min-jobs 150]
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchGreenhouse } from './sources/greenhouse.mjs';
import { fetchLever } from './sources/lever.mjs';
import { fetchAshby } from './sources/ashby.mjs';
import { fetchRemotive } from './sources/remotive.mjs';
import { fetchHn } from './sources/hn.mjs';
import { enrich } from './lib/enrich.mjs';
import { aggregate } from './lib/aggregate.mjs';
import { movers } from './lib/trends.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : def; };

async function pool(tasks, size = 6) {
  const results = new Array(tasks.length);
  let next = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (next < tasks.length) { const i = next++; results[i] = await tasks[i](); }
  }));
  return results;
}

export async function collect(sources) {
  const tasks = [
    ...sources.greenhouse.map((b) => ({ label: `greenhouse:${b}`, run: () => fetchGreenhouse(b) })),
    ...sources.lever.map((s) => ({ label: `lever:${s}`, run: () => fetchLever(s) })),
    ...(sources.ashby ?? []).map((b) => ({ label: `ashby:${b}`, run: () => fetchAshby(b) })),
    ...sources.remotive.map((c) => ({ label: `remotive:${c}`, run: () => fetchRemotive(c) })),
    { label: 'hn:who-is-hiring', run: () => fetchHn() },
  ];
  const report = [];
  const results = await pool(tasks.map((t) => async () => {
    try {
      const jobs = await t.run();
      report.push({ source: t.label, ok: true, fetched: jobs.length });
      return jobs;
    } catch (err) {
      report.push({ source: t.label, ok: false, error: String(err.message || err).slice(0, 160) });
      return [];
    }
  }));
  return { jobs: results.flat(), report: report.sort((a, b) => a.source.localeCompare(b.source)) };
}

async function main() {
  const out = join(ROOT, arg('out', 'site/data'));
  const today = arg('date', new Date().toISOString().slice(0, 10));
  const minJobs = Number(arg('min-jobs', 150));
  const sources = JSON.parse(readFileSync(join(ROOT, 'pipeline/sources.json'), 'utf8'));

  const latestPath = join(out, 'latest.json');
  const prevLatest = existsSync(latestPath) ? JSON.parse(readFileSync(latestPath, 'utf8')) : null;
  const previous = new Map((prevLatest?.jobs ?? []).map((j) => [j.id, j]));

  const { jobs: raw, report } = await collect(sources);
  const seen = new Set();
  const jobs = [];
  for (const r of raw) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    const e = enrich(r, { today, previous });
    if (e) jobs.push(e);
  }
  if (jobs.length < minJobs) {
    console.error(`Only ${jobs.length} target jobs (< ${minJobs}); refusing to overwrite good data.`);
    console.error(JSON.stringify(report.filter((r) => !r.ok), null, 2));
    process.exit(1);
  }

  const agg = aggregate(jobs);
  mkdirSync(join(out, 'history'), { recursive: true });
  const dates = existsSync(join(out, 'history')) ? readdirSync(join(out, 'history')).filter((f) => /^\d{4}-\d\d-\d\d\.json$/.test(f)).map((f) => f.slice(0, 10)).sort() : [];
  const baselineDate = dates.filter((d) => d < today).slice(-7)[0] ?? null;
  const baseline = baselineDate ? JSON.parse(readFileSync(join(out, 'history', `${baselineDate}.json`), 'utf8')).aggregate : null;

  const snapshot = {
    date: today,
    generatedAt: new Date().toISOString(),
    sources: report,
    firstRun: !prevLatest,
    newToday: prevLatest ? jobs.filter((j) => j.firstSeen === today).length : 0,
    aggregate: agg,
    movers: movers(agg, baseline),
    baselineDate,
  };
  writeFileSync(join(out, 'history', `${today}.json`), JSON.stringify({ date: today, aggregate: agg }));
  const allDates = [...new Set([...dates, today])].sort();
  writeFileSync(join(out, 'index.json'), JSON.stringify({ dates: allDates, latest: today }));
  writeFileSync(latestPath, JSON.stringify({ ...snapshot, jobs }));
  console.log(`${today}: ${jobs.length} target jobs from ${raw.length} postings; ${report.filter((r) => !r.ok).length} source failures; ${snapshot.newToday} new.`);
}


if (process.argv[1]?.endsWith('run.mjs')) await main();
