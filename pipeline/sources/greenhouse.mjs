import { getJson } from '../lib/http.mjs';
import { htmlToText } from '../lib/html.mjs';

export function normalizeGreenhouse(board, job) {
  return {
    id: `gh:${board}:${job.id}`,
    source: 'greenhouse',
    company: job.company_name || board,
    title: job.title,
    location: job.location?.name || '',
    url: job.absolute_url,
    postedAt: job.first_published || job.updated_at || null,
    updatedAt: job.updated_at || null,
    text: htmlToText(job.content || ''),
  };
}

export async function fetchGreenhouse(board, opts) {
  const data = await getJson(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`, opts);
  return (data?.jobs ?? []).map((j) => normalizeGreenhouse(board, j));
}
