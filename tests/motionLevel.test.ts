import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveMotionLevel, particleCount, blurPx } from '../src/utils/motionLevel.ts';

test('reduced motion always wins, even over a saved choice', () => {
  assert.equal(resolveMotionLevel({ reducedMotion: true, saved: 'full' }), 'off');
});

test('a saved choice beats the device default', () => {
  assert.equal(resolveMotionLevel({ saved: 'full', coarsePointer: true, width: 375 }), 'full');
  assert.equal(resolveMotionLevel({ saved: 'off', width: 1440 }), 'off');
  assert.equal(resolveMotionLevel({ saved: 'junk', width: 1440 }), 'full');
});

test('phones and weak devices default to lite; desktops to full', () => {
  assert.equal(resolveMotionLevel({ coarsePointer: true, width: 1024 }), 'lite');
  assert.equal(resolveMotionLevel({ width: 375 }), 'lite');
  assert.equal(resolveMotionLevel({ width: 1440, deviceMemory: 4 }), 'lite');
  assert.equal(resolveMotionLevel({ width: 1440, cores: 4 }), 'lite');
  assert.equal(resolveMotionLevel({ width: 1440, saveData: true }), 'lite');
  assert.equal(resolveMotionLevel({ width: 1440, deviceMemory: 8, cores: 8 }), 'full');
  assert.equal(resolveMotionLevel({}), 'full');
});

test('particle counts: none when off, a handful in lite, capped in full', () => {
  assert.equal(particleCount(70, 1, 'off'), 0);
  assert.ok(particleCount(70, 1, 'lite') <= 6 && particleCount(70, 1, 'lite') >= 3);
  assert.equal(particleCount(80, 1, 'full'), 56);
  assert.equal(particleCount(80, 0.55, 'full'), 31);
  assert.equal(particleCount(2, 1, 'full'), 4);
});

test('blur: none in lite/off, capped at 24px in full', () => {
  assert.equal(blurPx(40, 'lite'), 0);
  assert.equal(blurPx(40, 'full'), 24);
  assert.equal(blurPx(14, 'full'), 14);
});
