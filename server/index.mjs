import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { bus, createRun, getRun, listRuns, latestRun, runDir } from './store.mjs';
import { MODEL, activeRunId, startRun, stopRun } from './orchestrator.mjs';
import { RunInput } from './input.mjs';
import { PREVIEW_CSP } from './validation.mjs';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '12kb' }));
app.use((req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer'); next(); });
function owner(req, res, next) {
  if (req.headers.origin && req.headers.origin !== `${req.protocol}://${req.headers.host}`) return res.status(403).json({ error: 'Cross-origin controls are not allowed.' });
  const expected = process.env.ADMIN_TOKEN;
  if (expected) {
    const supplied = String(req.headers.authorization || '').replace(/^Bearer /, '');
    const a = Buffer.from(supplied); const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: 'Unlock owner controls to start or stop agents.' });
  } else if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) return res.status(403).json({ error: 'Hosted controls require an ADMIN_TOKEN.' });
  next();
}
app.get('/health', (req,res) => res.json({ ok: true }));
app.get('/api/config', (req,res) => res.json({ model: MODEL, configured: Boolean(process.env.OPENAI_API_KEY), ownerRequired: Boolean(process.env.ADMIN_TOKEN), hosted: false, maxProjects: 3 }));
app.get('/api/runs', (req,res) => res.json(listRuns()));
app.get('/api/state', (req,res) => { const run = req.query.id ? getRun(req.query.id) : latestRun(); res.setHeader('Cache-Control', 'no-store'); res.json(run); });
app.get('/api/events', (req,res) => {
  res.setHeader('Content-Type', 'text/event-stream'); res.setHeader('Cache-Control', 'no-cache'); res.setHeader('Connection', 'keep-alive'); res.flushHeaders();
  const send = run => res.write(`event: state\ndata: ${JSON.stringify(run)}\n\n`);
  if (latestRun()) send(latestRun());
  bus.on('state', send);
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15000);
  req.on('close', () => { bus.off('state', send); clearInterval(heartbeat); });
});
app.post('/api/runs', owner, (req,res) => {
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'The server is missing its OpenAI API key.' });
  if (activeRunId()) return res.status(409).json({ error: 'A run is already in progress. Stop it before starting another.' });
  const input = RunInput.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: input.error.issues.map(i => i.message).join(' ') });
  const run = createRun(input.data, MODEL); void startRun(run); res.status(202).json(run);
});
app.post('/api/runs/:id/stop', owner, (req,res) => res.status(stopRun(req.params.id) ? 202 : 404).json({ message: 'Stop request processed' }));
app.get('/api/artifact', (req,res) => {
  const run = getRun(req.query.run); const a = run?.artifacts.find(a => a.path === req.query.path);
  if (!a) return res.status(404).json({ error: 'Artifact not found' });
  res.type('text/plain').send(fs.readFileSync(path.join(runDir(run.id), a.path), 'utf8'));
});
app.get('/preview/:run/:project', (req,res) => {
  const run = getRun(req.params.run); const project = run?.projects.find(p => p.id === req.params.project);
  if (!project?.previewUrl) return res.status(404).send('This application has no preview yet.');
  res.setHeader('Content-Security-Policy', PREVIEW_CSP);
  res.type('html').send(fs.readFileSync(path.join(runDir(run.id), 'apps', project.id, 'preview.html'), 'utf8'));
});
if (process.argv.includes('--production')) {
  app.use(express.static('dist')); app.get('/{*rest}', (req,res) => res.sendFile(path.resolve('dist/index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}
app.use((err,req,res,next) => { console.error(err.name); res.status(500).json({ error: 'The request could not be completed.' }); });
const port = Number(process.env.PORT || 4310);
app.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`recruiter.ai listening at http://127.0.0.1:${port} · model ${MODEL}`));
