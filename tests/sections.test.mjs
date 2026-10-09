import test from 'node:test';
import assert from 'node:assert/strict';
import { splitSections } from '../pipeline/lib/sections.mjs';

const POST = `About us
We build things.
What you'll do
Ship services.
Requirements
- 5+ years of Python
- Experience with Kubernetes
Nice to have
- Rust
- Experience with CUDA kernels
Benefits
Health insurance`;

test('routes lines to required, preferred and other', () => {
  const s = splitSections(POST);
  assert.match(s.required, /Python/);
  assert.match(s.required, /Kubernetes/);
  assert.match(s.preferred, /Rust/);
  assert.doesNotMatch(s.required, /Rust/);
  assert.match(s.other, /Health insurance/);
});
test('returns empty required when there is no requirements heading', () => {
  assert.equal(splitSections('Just a blob of text about Python.').required, '');
});
test('inline bonus lines go to preferred', () => {
  const s = splitSections('Requirements\n- Go\nBonus: experience contributing to open source infrastructure projects');
  assert.match(s.preferred, /open source/);
});
