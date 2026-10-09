// Generate site/data/buildlog.json from the real git history and docs/reviews.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function parseLog(raw) {
  return raw.split('\n').filter(Boolean).map((line) => {
    const [hash, date, ...rest] = line.split('|');
    return { hash, date, subject: rest.join('|') };
  });
}

export function buildLog({ git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }), reviewsDir = join(ROOT, 'docs/reviews') } = {}) {
  const commits = parseLog(git(['log', '--pretty=format:%h|%ad|%s', '--date=short']));
  const reviews = existsSync(reviewsDir)
    ? readdirSync(reviewsDir).filter((f) => f.endsWith('.md')).sort().map((f) => ({
        file: `docs/reviews/${f}`,
        title: (readFileSync(join(reviewsDir, f), 'utf8').match(/^#\s+(.+)$/m) || [, f])[1],
      }))
    : [];
  return {
    generatedAt: new Date().toISOString(),
    commitCount: commits.length,
    daily: commits.filter((c) => /^data(\(|:)/.test(c.subject)).length,
    commits: commits.slice(0, 400),
    reviews,
  };
}

if (process.argv[1]?.endsWith('buildlog.mjs')) {
  const out = join(ROOT, 'site/data');
  mkdirSync(out, { recursive: true });
  const log = buildLog();
  writeFileSync(join(out, 'buildlog.json'), JSON.stringify(log));
  console.log(`build log: ${log.commitCount} commits, ${log.reviews.length} reviews`);
}
