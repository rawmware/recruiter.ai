import test from 'node:test';
import assert from 'node:assert/strict';
import { yearsRequired, degreeSignal, sponsorship, salaryRange, askSentences } from '../pipeline/lib/signals.mjs';
import { extractSkills } from '../pipeline/lib/taxonomy.mjs';

test('years of experience takes the lowest stated bar', () => {
  assert.equal(yearsRequired('5+ years of experience in backend'), 5);
  assert.equal(yearsRequired('3-5 years of professional software experience'), 3);
  assert.equal(yearsRequired('no numbers here'), null);
});
test('degree signals', () => {
  assert.equal(degreeSignal("Bachelor's degree or equivalent practical experience"), 'or-equivalent');
  assert.equal(degreeSignal('PhD preferred'), 'phd');
  assert.equal(degreeSignal('We love builders'), 'unspecified');
});
test('sponsorship', () => {
  assert.equal(sponsorship('We are unable to sponsor visas'), 'no');
  assert.equal(sponsorship('Visa sponsorship is available'), 'yes');
});
test('salary parsing handles $, k and commas', () => {
  assert.deepEqual(salaryRange('Pay range $180,000 - $250,000 USD'), { min: 180000, max: 250000, currency: 'USD' });
  assert.deepEqual(salaryRange('base 150k to 200k'), { min: 150000, max: 200000, currency: 'USD' });
  assert.equal(salaryRange('1-2 years'), null);
});
test('ask sentences quote employer wants', () => {
  const t = 'About us\n- Experience with building production LLM applications at scale\nBenefits';
  assert.equal(askSentences(t).length, 1);
});
test('skill extraction', () => {
  const s = extractSkills('We use Python, PyTorch and Kubernetes on AWS. Build RAG with vector databases. C++ a plus.');
  for (const k of ['Python', 'PyTorch', 'Kubernetes', 'AWS', 'RAG', 'Vector databases', 'C++']) assert.ok(s.includes(k), k);
  assert.ok(!s.includes('Java'));
  assert.ok(!extractSkills('We use JavaScript').includes('Java'));
});
