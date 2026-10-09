// Minimal static server for ./site (no dependencies). Usage: node scripts/serve.mjs [port]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SITE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'site');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml' };

// Map a URL path to a file inside ./site, or null if it would escape it.
export function resolvePath(urlPath) {
  let clean;
  try { clean = normalize(decodeURIComponent(urlPath.split('?')[0])).replace(/^([/\\])+/, ''); } catch { return null; }
  const full = join(SITE_ROOT, clean || 'index.html');
  return full.startsWith(SITE_ROOT) ? full : null;
}

export const server = createServer(async (req, res) => {
  let file = resolvePath(req.url);
  try {
    if (!file) throw new Error('forbidden');
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
});

if (process.argv[1]?.endsWith('serve.mjs')) {
  const port = Number(process.argv[2] || 4320);
  server.listen(port, '127.0.0.1', () => console.log(`recruiter.ai on http://127.0.0.1:${port}`));
}
