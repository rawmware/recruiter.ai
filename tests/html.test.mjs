import test from 'node:test';
import assert from 'node:assert/strict';
import { htmlToText, decodeEntities } from '../pipeline/lib/html.mjs';

test('decodes named and numeric entities', () => {
  assert.equal(decodeEntities('a &amp; b &#65; &#x42;'), 'a & b A B');
});
test('strips tags and keeps list structure', () => {
  assert.equal(htmlToText('<p>Hi</p><ul><li>Python</li><li>Go</li></ul>'), 'Hi\n- Python\n- Go');
});
test('handles double-encoded greenhouse content', () => {
  assert.equal(htmlToText('&lt;p&gt;Build &amp;amp; ship&lt;/p&gt;'), 'Build & ship');
});
test('drops scripts', () => {
  assert.equal(htmlToText('<script>alert(1)</script>ok'), 'ok');
});
