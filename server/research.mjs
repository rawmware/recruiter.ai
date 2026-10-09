import { load } from 'cheerio';
import { event, publish } from './store.mjs';

// Deliberately bounded public recruiting hosts. No arbitrary/private network fetches.
const publicHosts = new Set(['www.indeed.com', 'indeed.com', 'boards.greenhouse.io', 'job-boards.greenhouse.io', 'boards-api.greenhouse.io', 'jobs.lever.co', 'api.lever.co', 'jobs.ashbyhq.com', 'api.ashbyhq.com', 'remotive.com']);
export function validateJobUrl(value) {
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443') || !publicHosts.has(u.hostname)) throw new Error('Use an HTTPS job link from Indeed, Greenhouse, Lever, Ashby, or Remotive.');
  return u;
}
export function plain(html) { return load(String(html || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>')).text().replace(/\s+/g, ' ').trim(); }
export async function fetchPublic(url, signal, redirects = 0) {
  validateJobUrl(url);
  const response = await fetch(url, { signal: AbortSignal.any([signal || new AbortController().signal, AbortSignal.timeout(18000)]), redirect: 'manual', headers: { 'User-Agent': 'RecruiterAI/1.0 (public job research)', Accept: 'application/json,text/html' } });
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    if (redirects >= 3) throw new Error('Too many redirects');
    return fetchPublic(new URL(response.headers.get('location'), url).href, signal, redirects + 1);
  }
  if (!response.ok) throw new Error(`Source returned HTTP ${response.status}${response.status === 403 ? ' (access restricted)' : ''}`);
  const reader = response.body.getReader(); let size = 0; const chunks = [];
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 12000000) { await reader.cancel(); throw new Error('Source too large'); } chunks.push(Buffer.from(value)); }
  return Buffer.concat(chunks).toString('utf8');
}
function rank(jobs, goal) {
  const words = goal.toLowerCase().split(/[^a-z0-9+#]+/).filter(w => w.length > 2 && !['and', 'the', 'for', 'with', 'build', 'applications', 'demonstrate', 'looking'].includes(w));
  return jobs.map(j => ({ ...j, score: words.reduce((s, w) => s + (j.title.toLowerCase().includes(w) ? 5 : 0) + (j.description.toLowerCase().includes(w) ? 1 : 0), 0) })).sort((a,b) => b.score - a.score);
}
function jsonJobs(text, url) {
  const $ = load(text); const jobs = [];
  function walk(o) { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) { o.forEach(walk); return; } if (o['@type'] === 'JobPosting' || o['@type']?.includes?.('JobPosting')) jobs.push({ title: plain(o.title), company: o.hiringOrganization?.name || 'Employer', url, location: o.jobLocation?.address?.addressLocality || o.jobLocationType || 'See posting', description: plain(o.description), postedAt: o.datePosted || null }); if (o['@graph']) walk(o['@graph']); }
  $('script[type="application/ld+json"]').each((_, el) => { try { walk(JSON.parse($(el).text())); } catch {} });
  return jobs;
}
export async function collectJobs(run, signal, terms) {
  const sources = run.sources;
  const jobs = [];
  const tasks = [];
  if (sources.includes('greenhouse')) for (const board of ['anthropic', 'vercel', 'figma']) tasks.push({ name: `Greenhouse / ${board}`, url: `https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`, parse: t => JSON.parse(t).jobs.map(j => ({ title: j.title, company: board, url: j.absolute_url, location: j.location?.name || 'Unspecified', description: plain(j.content), postedAt: j.updated_at })) });
  if (sources.includes('remotive')) tasks.push({ name: 'Remotive', url: 'https://remotive.com/api/remote-jobs?category=software-dev&limit=80', parse: t => JSON.parse(t).jobs.map(j => ({ title: j.title, company: j.company_name, url: j.url, location: j.candidate_required_location, description: plain(j.description), postedAt: j.publication_date })) });
  if (sources.includes('lever')) tasks.push({ name: 'Lever / Spotify', url: 'https://api.lever.co/v0/postings/spotify?mode=json', parse: t => JSON.parse(t).map(j => ({ title: j.text, company: 'Spotify', url: j.hostedUrl, location: j.categories?.location || 'Unspecified', description: plain(j.descriptionPlain + ' ' + (j.lists || []).map(l => l.text + ' ' + l.content).join(' ')), postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : null })) });
  for (const url of run.jobUrls) tasks.push({ name: new URL(url).hostname, url, parse: t => jsonJobs(t, url) });
  await Promise.all(tasks.map(async source => {
    event(run, 'researcher', 'source', `Reading ${source.name}`);
    try {
      const parsed = source.parse(await fetchPublic(source.url, signal));
      const valid = parsed.filter(j => j.title && j.description?.length > 100 && /^https:\/\//.test(j.url));
      if (!valid.length) throw new Error('No readable JobPosting data; the source may restrict automated access.');
      jobs.push(...rank(valid, terms).slice(0, 8).map(j => ({ ...j, source: source.name, fetchedAt: new Date().toISOString() })));
      run.sourceResults.push({ name: source.name, status: 'read', count: valid.length });
      event(run, 'researcher', 'source', `${source.name}: ${valid.length} real postings available`);
    } catch (e) {
      if (signal.aborted) throw e;
      run.sourceResults.push({ name: source.name, status: 'unavailable', error: e.message });
      event(run, 'researcher', 'warning', `${source.name}: ${e.message}`);
    }
  }));
  signal.throwIfAborted();
  const dedup = [...new Map(jobs.map(j => [j.url, j])).values()];
  run.jobs = rank(dedup, terms).slice(0, 12).map((j, i) => {
    const description = j.description.slice(0, 16000);
    const excerpts = (description.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [description]).map(s => s.trim()).filter(s => s.length > 35 && /prefer|nice|bonus|build|develop|experience|work|design|responsib|customer|product/i.test(s)).slice(0, 24).map((text, n) => ({ id: `excerpt-${n + 1}`, quote: text.slice(0, 900) }));
    return { ...j, id: `job-${i + 1}`, description, excerpts };
  });
  publish(run);
  if (!run.jobs.length) throw new Error('No readable job postings found. Try another source or a direct supported job link.');
  return run.jobs.map(({description, ...j}) => j);
}
export function validateEvidence(signals, jobs) {
  if (!signals.length) throw new Error('Research produced no hiring signals.');
  for (const s of signals) {
    if (!s.evidence.length) throw new Error('A hiring signal has no source evidence.');
    for (const e of s.evidence) {
      const job = jobs.find(j => j.id === e.jobId);
      if (!job || e.quote.length < 12 || !job.description.toLowerCase().includes(e.quote.replace(/\s+/g, ' ').trim().toLowerCase())) throw new Error(`Unverifiable excerpt for ${e.jobId}. Use an exact continuous quote from the posting.`);
    }
  }
}
