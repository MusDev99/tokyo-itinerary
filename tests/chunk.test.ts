import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunk, mapPool } from '../src/utils/chunk.ts';

test('chunk splits in order and handles edges', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 3), []);
  assert.deepEqual(chunk([1, 2], 0), [[1], [2]]);
  assert.equal(chunk(Array.from({ length: 230 }, (_, i) => i), 25).length, 10);
});

test('mapPool keeps order and never exceeds the concurrency limit', async () => {
  let running = 0;
  let peak = 0;
  const out = await mapPool([30, 10, 20, 5, 15, 1], 3, async (ms, i) => {
    running++;
    peak = Math.max(peak, running);
    await new Promise((r) => setTimeout(r, ms));
    running--;
    return i * 2;
  });
  assert.deepEqual(out, [0, 2, 4, 6, 8, 10]);
  assert.ok(peak <= 3 && peak >= 2);
});

test('mapPool rejects when a call fails', async () => {
  await assert.rejects(mapPool([1, 2, 3], 2, async (n) => { if (n === 2) throw new Error('boom'); return n; }), /boom/);
});
