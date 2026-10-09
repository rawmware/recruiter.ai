import { getJson } from '../lib/http.mjs';
import { prettyCompany } from '../lib/names.mjs';

export function normalizeLever(site, p) {
  const listText = (p.lists ?? []).map((l) => `${l.text}\n${(l.content || '').replace(/<[^>]+>/g, '\n')}`).join('\n');
  const salary = p.salaryRange ? `Salary ${p.salaryRange.min}-${p.salaryRange.max} ${p.salaryRange.currency || ''}` : '';
  return {
    id: `lv:${site}:${p.id}`,
    source: 'lever',
    company: prettyCompany(site),
    title: p.text,
    location: p.categories?.location || p.country || '',
    url: p.hostedUrl,
    postedAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
    updatedAt: null,
    text: [p.descriptionPlain, listText, p.additionalPlain, salary].filter(Boolean).join('\n'),
  };
}

export async function fetchLever(site, opts) {
  const data = await getJson(`https://api.lever.co/v0/postings/${site}?mode=json`, opts);
  return (Array.isArray(data) ? data : []).map((p) => normalizeLever(site, p));
}
