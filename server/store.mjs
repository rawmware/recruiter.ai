import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';

export const DATA = path.resolve(process.env.DATA_DIR || 'data');
export const bus = new EventEmitter();
bus.setMaxListeners(100);
const runs = new Map();
export const roles = [
  ['boss', 'The Boss', 'Direction & decisions'],
  ['researcher', 'Researcher', 'Jobs → hiring signals'],
  ['architect', 'Architect', 'Signals → project briefs'],
  ['builder', 'Builder', 'Briefs → working software'],
  ['supervisor', 'Supervisor', 'Evidence & accountability'],
];
fs.mkdirSync(path.join(DATA, 'runs'), { recursive: true });
for (const dir of fs.readdirSync(path.join(DATA, 'runs'))) {
  try {
    const run = JSON.parse(fs.readFileSync(path.join(DATA, 'runs', dir, 'state.json'), 'utf8'));
    if (['running', 'stopping'].includes(run.status)) {
      run.status = 'interrupted';
      run.error = 'The server restarted during this run. Its artifacts are preserved. Start a new run to continue research.';
      for (const a of Object.values(run.agents)) if (['working', 'watching'].includes(a.status)) a.status = 'interrupted';
    }
    runs.set(run.id, run);
  } catch { /* An incomplete state file is not a valid run. */ }
}
export function runDir(id) { return path.join(DATA, 'runs', id); }
export function persist(run) {
  const dir = runDir(run.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'state.tmp'), JSON.stringify(run));
  fs.renameSync(path.join(dir, 'state.tmp'), path.join(dir, 'state.json'));
}
export function publish(run) { run.updatedAt = new Date().toISOString(); persist(run); bus.emit('state', run); }
export function createRun(input, model) {
  const now = new Date().toISOString();
  const run = { id: randomUUID(), ...input, model, status: 'running', phase: 'Planning', startedAt: now, updatedAt: now,
    agents: Object.fromEntries(roles.map(([id, name, role]) => [id, { id, name, role, status: 'idle', task: 'Awaiting assignment', updatedAt: now, outputChars: 0, calls: 0 }])),
    jobs: [], signals: [], projects: [], artifacts: [], events: [], reports: [], decisions: [], usage: { input: 0, output: 0, calls: 0 }, sourceResults: [], error: null };
  runs.set(run.id, run); publish(run); return run;
}
export function getRun(id) { return runs.get(id); }
export function listRuns() { return [...runs.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).map(r => ({ id: r.id, goal: r.goal, status: r.status, startedAt: r.startedAt, projects: r.projects.length })); }
export function latestRun() { return getRun(listRuns()[0]?.id) || null; }
export function event(run, agent, kind, message, to = null) {
  run.events.push({ id: randomUUID(), at: new Date().toISOString(), agent, kind, message, to });
  if (run.events.length > 600) run.events.shift();
  publish(run);
}
export function agentState(run, id, state) { Object.assign(run.agents[id], state, { updatedAt: new Date().toISOString() }); publish(run); }
export function artifact(run, relative, content, kind, projectId = null) {
  if (!/^[a-zA-Z0-9_./-]+$/.test(relative) || relative.split('/').includes('..')) throw new Error('Invalid artifact path');
  const target = path.join(runDir(run.id), relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  const item = { path: relative, kind, projectId, bytes: Buffer.byteLength(content) };
  run.artifacts = [...run.artifacts.filter(a => a.path !== relative), item];
  event(run, kind === 'brief' ? 'architect' : 'builder', 'artifact', `Wrote ${relative}`);
  return item;
}
