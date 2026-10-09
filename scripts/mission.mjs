import { createRun, bus, event } from '../server/store.mjs';
import { MODEL, startRun, stopRun } from '../server/orchestrator.mjs';
import { RunInput } from '../server/input.mjs';
import { createPublisher } from '../server/publisher.mjs';

const input = RunInput.parse(JSON.parse(process.env.MISSION_JSON || JSON.stringify({ goal: process.env.MISSION_GOAL || 'Find what employers prefer in frontend and product engineers. Build practical interactive tools that demonstrate those capabilities.', projectCount: Number(process.env.PROJECT_COUNT || 2), sources: ['greenhouse', 'remotive'], jobUrls: [] })));
if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY must be configured as a repository Actions secret.');
const publish = createPublisher(); const run = createRun(input, MODEL);
if (process.env.GITHUB_RUN_ID) run.workflowUrl = `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
let dirty = true; let uploading = false; let published = true;
bus.on('state', () => { dirty = true; });
async function flush() {
  if (!dirty || uploading) return;
  uploading = true; dirty = false;
  try { await publish(run); published = true; } catch(e) { dirty = true; published = false; console.error(e.message); } finally { uploading = false; }
}
const interval = setInterval(flush, 15000);
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => stopRun(run.id));
await flush();
await startRun(run);
clearInterval(interval);
await publish(run);
console.log(JSON.stringify({ id: run.id, status: run.status, projects: run.projects.map(p=>({name:p.name,status:p.status})), usage: run.usage }));
if (run.status === 'failed' || run.status === 'partial') process.exitCode = 1;
