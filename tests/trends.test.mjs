import test from 'node:test';
import assert from 'node:assert/strict';
import { movers } from '../pipeline/lib/trends.mjs';
import { enrich } from '../pipeline/lib/enrich.mjs';

const agg = (skills) => ({ tracks: { all: { skills } } });

test('movers ranks risers and fallers', () => {
  const m = movers(agg([{ name: 'A', count: 10, share: 0.5 }, { name: 'B', count: 10, share: 0.1 }]), agg([{ name: 'A', share: 0.2 }, { name: 'B', share: 0.3 }]));
  assert.equal(m.all.rising[0].name, 'A');
  assert.equal(m.all.falling[0].name, 'B');
});
test('movers handles missing baseline', () => {
  assert.equal(movers(agg([]), null).baseline, null);
});
test('enrich drops non-target roles and keeps firstSeen', () => {
  const job = { id: 'x', source: 's', company: 'c', title: 'Senior ML Engineer', location: 'Remote', url: 'u', text: 'We want PyTorch. 5+ years of experience.', postedAt: null };
  assert.equal(enrich({ ...job, title: 'Account Executive' }, { today: '2026-10-08' }), null);
  const e = enrich(job, { today: '2026-10-08', previous: new Map([['x', { firstSeen: '2026-10-01' }]]) });
  assert.equal(e.track, 'ml');
  assert.equal(e.firstSeen, '2026-10-01');
  assert.ok(e.skills.includes('PyTorch'));
  assert.equal(e.years, 5);
});
