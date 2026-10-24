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

test('never goes above the top margin on short screens', () => {
  assert.equal(anchorPosition({ top: 300, bottom: 344, left: 16 }, pop, { width: 375, height: 500 }).top, 8);
});
