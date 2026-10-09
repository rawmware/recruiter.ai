import test from 'node:test';
import assert from 'node:assert/strict';
import { TAXONOMY } from '../pipeline/lib/taxonomy.mjs';

test('no regex contains control characters (a lone "\b" in JSON becomes backspace)', () => {
  for (const s of TAXONOMY) assert.ok(!/[\u0000-\u001f]/.test(s.re.source), `${s.name} has a control character`);
});
test('skill names are unique and categorized', () => {
  const names = TAXONOMY.map((s) => s.name);
  assert.equal(new Set(names).size, names.length);
  assert.ok(TAXONOMY.every((s) => s.category));
});
test('boilerplate does not trigger niche skills', () => {
  const boiler = 'We are an equal opportunity employer. Our team values alignment with company goals and a secure, inclusive workplace.';
  const hits = TAXONOMY.filter((s) => s.re.test(boiler)).map((s) => s.name);
  assert.deepEqual(hits, []);
});
