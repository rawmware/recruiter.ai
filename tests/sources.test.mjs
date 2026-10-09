import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGreenhouse } from '../pipeline/sources/greenhouse.mjs';
import { normalizeLever } from '../pipeline/sources/lever.mjs';
import { normalizeRemotive } from '../pipeline/sources/remotive.mjs';
import { normalizeHnComment } from '../pipeline/sources/hn.mjs';

test('greenhouse job normalizes', () => {
  const j = normalizeGreenhouse('acme', { id: 1, title: 'SWE', absolute_url: 'u', location: { name: 'NYC' }, content: '&lt;p&gt;Go&lt;/p&gt;', company_name: 'Acme' });
  assert.deepEqual([j.id, j.company, j.location, j.text], ['gh:acme:1', 'Acme', 'NYC', 'Go']);
});
test('lever job normalizes with salary and lists', () => {
  const j = normalizeLever('acme', { id: 'x', text: 'ML Eng', hostedUrl: 'u', categories: { location: 'SF' }, descriptionPlain: 'Hi', lists: [{ text: 'Reqs', content: '<li>Python</li>' }], salaryRange: { min: 1, max: 2, currency: 'USD' } });
  assert.match(j.text, /Python/);
  assert.match(j.text, /Salary 1-2 USD/);
});
test('remotive job is remote', () => {
  assert.equal(normalizeRemotive({ id: 5, title: 't', company_name: 'c', url: 'u', description: '<b>x</b>' }).location, 'Remote');
});
test('hn comment parses pipe header', () => {
  const j = normalizeHnComment({ id: 9, text: 'Acme | Senior ML Engineer | Remote | Full-time<p>We use PyTorch', created_at: '2026-10-01T00:00:00Z' });
  assert.equal(j.company, 'Acme');
  assert.equal(j.title, 'Senior ML Engineer');
  assert.equal(j.location, 'Remote');
});

import { prettyCompany } from '../pipeline/lib/names.mjs';
test('company display names', () => {
  assert.equal(prettyCompany('shieldai'), 'Shield AI');
  assert.equal(prettyCompany('some-new_co'), 'Some New Co');
  assert.equal(normalizeLever('shieldai', { id: 1, text: 't' }).company, 'Shield AI');
});

import { normalizeAshby } from '../pipeline/sources/ashby.mjs';
test('ashby job carries remote flag and compensation text', () => {
  const j = normalizeAshby('openai', { id: 'a', title: 'ML Eng', isRemote: true, location: 'US', jobUrl: 'u', descriptionPlain: 'Hi', compensation: { scrapeableCompensationSalarySummary: '$100K - $200K' } });
  assert.equal(j.company, 'OpenAI');
  assert.equal(j.location, 'Remote - US');
  assert.match(j.text, /Salary \$100K - \$200K/);
});
