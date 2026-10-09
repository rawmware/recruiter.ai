import { getJson } from '../lib/http.mjs';
import { htmlToText } from '../lib/html.mjs';

// HN "Ask HN: Who is hiring?" is posted monthly by user whoishiring. Each top-level
// comment is one posting, conventionally "Company | Role | Location | ..." on line one.
export function normalizeHnComment(c) {
  const text = htmlToText(c.text || '');
  const first = text.split('\n')[0] || '';
  const parts = first.split('|').map((s) => s.trim()).filter(Boolean);
  const company = parts[0]?.slice(0, 80) || 'Unknown';
  const roleish = parts.find((p, i) => i > 0 && /engineer|developer|scientist|ml|ai|research|swe|full[- ]?stack/i.test(p));
  return {
    id: `hn:${c.id}`,
    source: 'hn',
    company,
    title: (roleish || parts[1] || first).slice(0, 120),
    location: parts.find((p) => /remote|onsite|hybrid|, [A-Z]{2}\b|london|berlin|new york|san francisco/i.test(p)) || '',
    url: `https://news.ycombinator.com/item?id=${c.id}`,
    postedAt: c.created_at || null,
    updatedAt: null,
    text,
  };
}

export async function fetchHn(opts) {
  const search = await getJson('https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&hitsPerPage=6', opts);
  const story = (search?.hits ?? []).find((h) => /who is hiring/i.test(h.title) && !/freelancer|wants to be hired/i.test(h.title));
  if (!story) return [];
  const tree = await getJson(`https://hn.algolia.com/api/v1/items/${story.objectID}`, opts);
  return (tree?.children ?? []).filter((c) => c.text).map(normalizeHnComment);
}
