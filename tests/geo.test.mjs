import test from 'node:test';
import assert from 'node:assert/strict';
import { metroOf } from '../pipeline/lib/geo.mjs';

test('metro bucketing', () => {
  assert.equal(metroOf('San Francisco, CA'), 'San Francisco Bay Area');
  assert.equal(metroOf('Remote'), 'Remote (anywhere)');
  assert.equal(metroOf('New York City, NY'), 'New York');
  assert.equal(metroOf('Remote - US'), 'Remote (anywhere)');
  assert.equal(metroOf('Tulsa, OK'), 'Other US');
  assert.equal(metroOf(''), 'Unspecified');
});
