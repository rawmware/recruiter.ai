import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { runDir } from './store.mjs';

const repo = process.env.GITHUB_REPOSITORY || 'rawmware/recruiter.ai';
export async function github(route, options = {}) {
  const r = await fetch(`https://api.github.com/repos/${repo}${route}`, { ...options, headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28', ...options.headers }, signal: AbortSignal.timeout(30000) });
  if (r.status === 404 && options.allowMissing) return null;
  if (!r.ok) throw new Error(`GitHub ${route}: HTTP ${r.status}`);
  return r.status === 204 ? null : r.json();
}
export function createPublisher() {
  let head = null; let baseTree = null; let history = []; let initialized = false;
  let chain = Promise.resolve(); const hashes = new Map();
  async function publishState(run) {
    if (!initialized) {
      const ref = await github('/git/ref/heads/live', { allowMissing: true });
      if (ref) {
        head = ref.object.sha;
        baseTree = (await github(`/git/commits/${head}`)).tree.sha;
        const existing = await github('/contents/runs.json?ref=live', { allowMissing: true });
        if (existing?.content) history = JSON.parse(Buffer.from(existing.content, 'base64').toString());
      }
      initialized = true;
    }
    const entry = { id: run.id, goal: run.goal, status: run.status, startedAt: run.startedAt, projects: run.projects.length };
    history = [entry, ...history.filter(h => h.id !== run.id)].slice(0, 50);
    const compact = structuredClone(run);
    // Only the supporting excerpts belong in the public record, not full scraped descriptions.
    compact.jobs = compact.jobs.map(({description, ...j}) => j);
    const files = [
      ['state.json', JSON.stringify(compact)],
      [`runs/${run.id}/state.json`, JSON.stringify(compact)],
      ['runs.json', JSON.stringify(history)],
      ...run.artifacts.map(a => [`runs/${run.id}/${a.path}`, fs.readFileSync(path.join(runDir(run.id), a.path), 'utf8')]),
    ];
    const tree = []; const newHashes = [];
    for (const [name, content] of files) {
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      if (hashes.get(name) === hash) continue;
      tree.push({ path: name, mode: '100644', type: 'blob', content }); newHashes.push([name, hash]);
    }
    if (!tree.length) return;
    const nextTree = await github('/git/trees', { method: 'POST', body: JSON.stringify({ ...(baseTree ? { base_tree: baseTree } : {}), tree }) });
    const commit = await github('/git/commits', { method: 'POST', body: JSON.stringify({ message: `Mission ${run.id.slice(0,8)}: ${run.phase}`, tree: nextTree.sha, parents: head ? [head] : [] }) });
    if (head) await github('/git/refs/heads/live', { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }) });
    else await github('/git/refs', { method: 'POST', body: JSON.stringify({ ref: 'refs/heads/live', sha: commit.sha }) });
    head = commit.sha; baseTree = nextTree.sha; for (const [name, hash] of newHashes) hashes.set(name, hash);
    console.log(`Published ${run.phase}: ${run.projects.filter(p=>p.status==='ready').length} applications ready`);
  }
  return run => { const snapshot = structuredClone(run); chain = chain.catch(()=>{}).then(()=>publishState(snapshot)); return chain; };
}
