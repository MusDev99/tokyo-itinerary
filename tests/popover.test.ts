import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anchorPosition } from '../src/utils/popover.ts';

const viewport = { width: 375, height: 812 };
const pop = { width: 332, height: 420 };

test('opens under the trigger, left-aligned', () => {
  assert.deepEqual(anchorPosition({ top: 100, bottom: 144, left: 16 }, pop, viewport), { top: 152, left: 16 });
});

test('stays 8px inside the right edge', () => {
  assert.equal(anchorPosition({ top: 100, bottom: 144, left: 200 }, pop, viewport).left, 375 - 332 - 8);
});

test('flips above the trigger when there is no room below', () => {
  assert.equal(anchorPosition({ top: 700, bottom: 744, left: 16 }, pop, viewport).top, 700 - 420 - 8);
});

test('centres in the viewport (and says so) when it fits neither below nor above', () => {
  const r = anchorPosition({ top: 300, bottom: 344, left: 16 }, pop, { width: 375, height: 500 });
  assert.deepEqual(r, { top: 40, left: 16, centered: true });
});

test('never goes above the top margin on very short screens', () => {
  assert.equal(anchorPosition({ top: 200, bottom: 244, left: 16 }, pop, { width: 375, height: 400 }).top, 8);
});

test('a trigger just above the fold still gets the popover below when it fits', () => {
  assert.deepEqual(anchorPosition({ top: 100, bottom: 144, left: 16 }, pop, { width: 375, height: 600 }), { top: 152, left: 16 });
});
