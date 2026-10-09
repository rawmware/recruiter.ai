import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregate, topPairs, countBy } from '../pipeline/lib/aggregate.mjs';

const mk = (track, skills, extra = {}) => ({ track, skills, seniority: 'mid', workMode: 'remote', degree: 'unspecified', sponsorship: 'unspecified', company: 'A', years: null, salary: null, ...extra });

test('countBy flattens arrays', () => {
  assert.deepEqual(countBy([{ s: ['a', 'b'] }, { s: ['a'] }], (x) => x.s), { a: 2, b: 1 });
});
test('aggregate splits by track and ranks skills', () => {
  const r = aggregate([mk('ai', ['Python', 'LLMs']), mk('ai', ['Python']), mk('software', ['Go'])]);
  assert.equal(r.total, 3);
  assert.equal(r.tracks.ai.jobs, 2);
  assert.deepEqual({ ...r.tracks.ai.skills[0] }, { name: 'Python', count: 2, share: 1, required: 0, preferred: 0 });
  assert.equal(r.tracks.software.skills[0].name, 'Go');
  assert.equal(r.tracks.all.jobs, 3);
});
test('median salary and years', () => {
  const r = aggregate([mk('ml', [], { years: 3, salary: { min: 100, max: 200 } }), mk('ml', [], { years: 5, salary: { min: 200, max: 300 } })]);
  assert.equal(r.tracks.ml.years.medianMin, 4);
  assert.equal(r.tracks.ml.salary.medianMin, 150);
});
test('pairs count co-occurrence order-independently', () => {
  assert.deepEqual(topPairs([mk('ai', ['B', 'A']), mk('ai', ['A', 'B'])])[0], { pair: 'A + B', count: 2 });
});

test('required and preferred shares are tracked per skill', () => {
  const r = aggregate([mk('ai', ['Python', 'Rust'], { req: ['Python'], pref: ['Rust'], sectioned: true }), mk('ai', ['Python'], { req: [], pref: [], sectioned: false })]);
  const py = r.tracks.ai.skills.find((s) => s.name === 'Python');
  const rust = r.tracks.ai.skills.find((s) => s.name === 'Rust');
  assert.equal(py.required, 0.5);
  assert.equal(rust.preferred, 0.5);
  assert.equal(r.tracks.ai.sectionedShare, 0.5);
});
