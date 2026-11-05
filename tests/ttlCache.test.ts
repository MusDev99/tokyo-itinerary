import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTtlCache } from '../src/utils/ttlCache.ts';

test('a value lives for the ttl, then is gone', () => {
  const c = createTtlCache<string>(1000);
  c.set('a', 'x', 0);
  assert.equal(c.get('a', 999), 'x');
  assert.equal(c.get('a', 1000), undefined);
  assert.equal(c.size(), 0, 'expired entries are dropped');
});

test('misses are cacheable values too (null) and the oldest entry is evicted at the cap', () => {
  const c = createTtlCache<string | null>(1000, 2);
  c.set('a', null, 0);
  assert.equal(c.get('a', 1), null);
  c.set('b', 'b', 0);
  c.set('c', 'c', 0);
  assert.equal(c.get('a', 1), undefined);
  assert.equal(c.get('c', 1), 'c');
});
