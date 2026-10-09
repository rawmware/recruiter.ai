import { getJson } from '../lib/http.mjs';
import { htmlToText } from '../lib/html.mjs';

export function normalizeRemotive(j) {
  return {
    id: `rm:${j.id}`,
    source: 'remotive',
    company: j.company_name,
    title: j.title,
    location: j.candidate_required_location ? `Remote - ${j.candidate_required_location}` : 'Remote',
    url: j.url,
    postedAt: j.publication_date ? new Date(j.publication_date).toISOString() : null,
    updatedAt: null,
    text: `${htmlToText(j.description || '')}${j.salary ? `\nSalary ${j.salary}` : ''}`,
  };
}

export async function fetchRemotive(category, opts) {
  const data = await getJson(`https://remotive.com/api/remote-jobs?category=${encodeURIComponent(category)}`, opts);
  return (data?.jobs ?? []).map(normalizeRemotive);
}
