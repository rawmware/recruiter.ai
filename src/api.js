export const hosted = import.meta.env.VITE_HOSTED === 'true';
const endpoint = action => hosted ? `/api/recruiter?action=${action}` : `/api/${action}`;
export function token() { return sessionStorage.getItem('recruiter-owner') || ''; }
export async function api(action, options = {}) {
  const { params, ...request } = options;
  let url = endpoint(action);
  if (params) url += `${url.includes('?') ? '&' : '?'}${new URLSearchParams(params)}`;
  const response = await fetch(url, { ...request, headers: { 'Content-Type': 'application/json', ...(token() ? { Authorization: `Bearer ${token()}` } : {}), ...request.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
export function artifactUrl(run, path) { return `${endpoint('artifact')}${hosted ? '&' : '?'}${new URLSearchParams({ run, path })}`; }
export function previewUrl(run, project) { return hosted ? `/api/recruiter?action=preview&run=${run}&project=${project}` : `/preview/${run}/${project}`; }
export async function stop(id) { return hosted ? api('stop', { method: 'POST', body: JSON.stringify({ id }) }) : api(`runs/${id}/stop`, { method: 'POST' }); }
