import { getJson } from '../lib/http.mjs';
import { prettyCompany } from '../lib/names.mjs';

export function normalizeAshby(board, j) {
  const comp = j.compensation?.scrapeableCompensationSalarySummary || j.compensation?.compensationTierSummary || '';
  return {
    id: `ab:${board}:${j.id}`,
    source: 'ashby',
    company: prettyCompany(board),
    title: j.title,
    location: j.isRemote ? `Remote${j.location ? ` - ${j.location}` : ''}` : j.location || '',
    url: j.jobUrl || j.applyUrl,
    postedAt: j.publishedAt || null,
    updatedAt: null,
    text: [j.descriptionPlain, comp && `Salary ${comp}`].filter(Boolean).join('\n'),
  };
}

export async function fetchAshby(board, opts) {
  const data = await getJson(`https://api.ashbyhq.com/posting-api/job-board/${board}?includeCompensation=true`, opts);
  return (data?.jobs ?? []).filter((j) => j.isListed !== false).map((j) => normalizeAshby(board, j));
}
