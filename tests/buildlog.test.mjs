import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLog, buildLog } from '../scripts/buildlog.mjs';
import { resolvePath, SITE_ROOT } from '../scripts/serve.mjs';

test('parseLog keeps pipes inside subjects', () => {
  assert.deepEqual(parseLog('abc1234|2026-10-08|feat: a | b\n'), [{ hash: 'abc1234', date: '2026-10-08', subject: 'feat: a | b' }]);
});
test('buildLog counts daily data commits', () => {
  const log = buildLog({ git: () => 'a|2026-10-08|data: refresh 2026-10-08\nb|2026-10-07|feat: x\nc|2026-10-06|data(daily): y', reviewsDir: '/nope' });
  assert.equal(log.commitCount, 3);
  assert.equal(log.daily, 2);
  assert.deepEqual(log.reviews, []);
});
test('static server stays inside the site root', () => {
  for (const p of ['/../package.json', '/..%2F..%2Fpackage.json', '/../../etc/passwd']) {
    const r = resolvePath(p);
    assert.ok(r === null || r.startsWith(SITE_ROOT), p);
  }
  assert.ok(resolvePath('/').endsWith('index.html'));
});
