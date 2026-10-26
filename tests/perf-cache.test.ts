import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHEETS_FRESH_MS, SHEETS_STALE_MS, cacheState, timed } from '../src/utils/swr.ts';
import { compositorFrames } from '../src/utils/motion.ts';
import { pageCacheControl } from '../src/utils/security.ts';

test('sheet cache: fresh, then stale (served now, refreshed in background), then miss', () => {
  const t = timed(1_000);
  assert.equal(cacheState(t, 1_000), 'fresh');
  assert.equal(cacheState(t, 1_000 + SHEETS_FRESH_MS - 1), 'fresh');
  assert.equal(cacheState(t, 1_000 + SHEETS_FRESH_MS), 'stale');
  assert.equal(cacheState(t, 1_000 + SHEETS_STALE_MS - 1), 'stale');
  assert.equal(cacheState(t, 1_000 + SHEETS_STALE_MS), 'miss');
  assert.equal(cacheState(null, 0), 'miss', 'a write clears the cache: next read waits for Google');
});

test('page Cache-Control: guests reuse prefetched tabs, editors never kept (A01)', () => {
  assert.equal(pageCacheControl(false), 'private, max-age=30');
  assert.equal(pageCacheControl(true), 'private, no-store');
  assert.doesNotMatch(pageCacheControl(false), /public|s-maxage/, 'never on a shared CDN');
});

test('compositorFrames folds x/y/rotate/scale into one transform list', () => {
  assert.deepEqual(compositorFrames({ y: ['-12vh', '112vh'] }), { transform: ['translate(0px, -12vh)', 'translate(0px, 112vh)'] });
  assert.deepEqual(compositorFrames({ rotate: [0, 360] }), { transform: ['rotate(0deg)', 'rotate(360deg)'] });
  assert.deepEqual(compositorFrames({ x: [-40, 40] }), { transform: ['translate(-40px, 0px)', 'translate(40px, 0px)'] });
});

test('compositorFrames keeps opacity separate, a static base tilt, and aligns keyframe counts', () => {
  const f = compositorFrames({ x: ['0px', '320px'], y: ['0px', '200px'], opacity: [0, 1, 0] }, 'rotate(32deg)');
  assert.deepEqual(f.opacity, [0, 1, 0]);
  assert.deepEqual(f.transform, ['rotate(32deg) translate(0px, 0px)', 'rotate(32deg) translate(320px, 200px)'], 'opacity keeps its own 3 keyframes');
  const mixed = compositorFrames({ x: ['-6vw', '6vw'], scaleY: [0.8, 1, 1.25] });
  assert.deepEqual(mixed.transform, ['translate(-6vw, 0px) scaleY(0.8)', 'translate(0vw, 0px) scaleY(1)', 'translate(6vw, 0px) scaleY(1.25)'], 'shorter list interpolated, not snapped');
  assert.deepEqual(compositorFrames({ scale: [1, 1.12, 1], opacity: [0.8, 1, 0.8] }), { opacity: [0.8, 1, 0.8], transform: ['scale(1)', 'scale(1.12)', 'scale(1)'] });
  assert.deepEqual(compositorFrames({ opacity: [0, 1] }), { opacity: [0, 1] }, 'nothing to fold');
});
