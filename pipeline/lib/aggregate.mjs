import { TAXONOMY, categoryOf } from './taxonomy.mjs';
import { TRACKS } from './classify.mjs';

const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

export function countBy(items, keyFn) {
  const out = {};
  for (const it of items) for (const k of [].concat(keyFn(it))) if (k != null) out[k] = (out[k] || 0) + 1;
  return out;
}

const toSorted = (obj, total) =>
  Object.entries(obj)
    .map(([name, count]) => ({ name, count, share: total ? +(count / total).toFixed(4) : 0 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

// `jobs` are enriched postings: { track, skills[], seniority, workMode, years, degree, sponsorship, salary, company }
export function aggregate(jobs) {
  const total = jobs.length;
  const byTrack = {};
  for (const t of ['all', ...TRACKS]) {
    const subset = t === 'all' ? jobs : jobs.filter((j) => j.track === t);
    const skillCounts = countBy(subset, (j) => j.skills);
    const reqCounts = countBy(subset, (j) => j.req ?? []);
    const prefCounts = countBy(subset, (j) => j.pref ?? []);
    const sectioned = subset.filter((j) => j.sectioned).length;
    const categories = {};
    for (const s of withSplit(toSorted(skillCounts, subset.length), reqCounts, prefCounts, subset.length)) {
      const cat = categoryOf[s.name] ?? 'Other';
      (categories[cat] ||= []).push(s);
    }
    const years = subset.map((j) => j.years).filter((y) => y != null);
    const salaries = subset.map((j) => j.salary).filter(Boolean);
    byTrack[t] = {
      jobs: subset.length,
      skills: withSplit(toSorted(skillCounts, subset.length), reqCounts, prefCounts, subset.length),
      sectionedShare: subset.length ? +(sectioned / subset.length).toFixed(3) : 0,
      categories,
      seniority: toSorted(countBy(subset, (j) => j.seniority), subset.length),
      workMode: toSorted(countBy(subset, (j) => j.workMode), subset.length),
      degree: toSorted(countBy(subset, (j) => j.degree), subset.length),
      sponsorship: toSorted(countBy(subset, (j) => j.sponsorship), subset.length),
      years: { medianMin: median(years), statedShare: subset.length ? +(years.length / subset.length).toFixed(3) : 0 },
      salary: { n: salaries.length, medianMin: median(salaries.map((s) => s.min)), medianMax: median(salaries.map((s) => s.max)) },
      topCompanies: toSorted(countBy(subset, (j) => j.company), subset.length).slice(0, 15),
      // Skills that co-occur most often with each other: how employers bundle requirements.
      pairs: topPairs(subset),
    };
  }
  return { total, tracks: byTrack };
}

// Attach how often each skill appears under a requirements heading vs only under nice-to-have.
function withSplit(rows, reqCounts, prefCounts, total) {
  return rows.map((r) => ({ ...r, required: +((reqCounts[r.name] || 0) / (total || 1)).toFixed(4), preferred: +((prefCounts[r.name] || 0) / (total || 1)).toFixed(4) }));
}

export function topPairs(jobs, limit = 12) {
  const counts = {};
  for (const j of jobs) {
    const s = j.skills;
    for (let a = 0; a < s.length; a++) for (let b = a + 1; b < s.length; b++) {
      const key = [s[a], s[b]].sort().join(' + ');
      counts[key] = (counts[key] || 0) + 1;
    }
  }
  return Object.entries(counts).map(([pair, count]) => ({ pair, count })).sort((a, b) => b.count - a.count).slice(0, limit);
}

export { TAXONOMY };
