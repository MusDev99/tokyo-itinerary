import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEASONS } from '../src/utils/seasons.ts';
import { CHIMES, readSoundOn } from '../src/utils/seasonSound.ts';

test('the picker groups 4 seasons and 3 weather themes', () => {
  assert.equal(SEASONS.filter((s) => s.group === 'season').length, 4);
  assert.equal(SEASONS.filter((s) => s.group === 'weather').length, 3);
});

test('every theme has a short, quiet, audible chime', () => {
  for (const s of SEASONS) {
    const notes = CHIMES[s.id];
    assert.ok(notes?.length, `${s.id} has notes`);
    const end = Math.max(...notes.map((n) => n.at + n.dur));
    assert.ok(end <= 1, `${s.id} chime is at most 1s (${end}s)`);
    for (const n of notes) {
      assert.ok(n.gain > 0 && n.gain <= 1, `${s.id} gain in 0..1`);
      for (const f of [n.freq, n.to ?? n.freq]) assert.ok(f >= 100 && f <= 4000, `${s.id} ${f}Hz is in a comfortable range`);
    }
  }
});

test('sound defaults to on when storage is unavailable', () => {
  assert.equal(readSoundOn(), true);
});
