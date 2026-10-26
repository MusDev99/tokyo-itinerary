import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEASONS } from '../src/utils/seasons.ts';
import { MASTER, SCENES, fillNoise, nextDelay, readSoundOn } from '../src/utils/seasonSound.ts';

test('the picker groups 4 seasons and 3 weather themes', () => {
  assert.equal(SEASONS.filter((s) => s.group === 'season').length, 4);
  assert.equal(SEASONS.filter((s) => s.group === 'weather').length, 3);
});

test('every theme has a quiet, continuous ambient scene', () => {
  assert.ok(MASTER > 0 && MASTER <= 0.5, 'master volume stays low');
  for (const s of SEASONS) {
    const scene = SCENES[s.id];
    assert.ok(scene, `${s.id} has a scene`);
    const beds = [...(scene.noise ?? []), ...(scene.tones ?? [])];
    assert.ok(beds.length > 0, `${s.id} has a continuous layer (plays in the background, not just once)`);
    for (const b of beds) {
      assert.ok(b.gain > 0 && b.gain <= 0.6, `${s.id} layer gain in 0..0.6`);
      if (b.lfo) assert.ok(b.lfo.rate > 0 && b.lfo.rate <= 0.5 && b.lfo.depth > 0 && b.lfo.depth <= 1, `${s.id} slow swell`);
    }
    for (const e of scene.events ?? []) {
      assert.ok(e.every[0] >= 0.3 && e.every[0] <= e.every[1], `${s.id} events are spaced out`);
      assert.ok(e.gain > 0 && e.gain <= 0.15, `${s.id} events stay quiet`);
      assert.ok(e.dur > 0 && e.dur <= 1, `${s.id} events are short`);
      for (const f of e.freq) assert.ok(f >= 100 && f <= 6000, `${s.id} ${f}Hz is comfortable`);
    }
  }
});

test('noise generators stay in [-1, 1] and differ by colour', () => {
  let seed = 7;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const energy = (a: Float32Array) => a.reduce((s, v) => s + Math.abs(v), 0) / a.length;
  const diff = (a: Float32Array) => a.slice(1).reduce((s, v, i) => s + Math.abs(v - a[i]), 0) / (a.length - 1);
  const out: Record<string, Float32Array> = {};
  for (const c of ['white', 'pink', 'brown'] as const) {
    out[c] = fillNoise(new Float32Array(20000), c, rng);
    assert.ok(out[c].every((v) => v >= -1 && v <= 1), `${c} in range`);
    assert.ok(energy(out[c]) > 0.005, `${c} is audible`);
  }
  // Smoother (lower sample-to-sample change) as the colour gets darker
  assert.ok(diff(out.white) > diff(out.pink) && diff(out.pink) > diff(out.brown));
});

test('event spacing is random within its range', () => {
  assert.equal(nextDelay([2, 6], () => 0), 2);
  assert.equal(nextDelay([2, 6], () => 1), 6);
  assert.equal(nextDelay([2, 6], () => 0.5), 4);
});

test('sound defaults to on when storage is unavailable', () => {
  assert.equal(readSoundOn(), true);
});
