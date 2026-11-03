import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { project, placePins, PIN_COORDS, type MapCountry } from '../src/utils/worldMap.ts';

const c = (slug: string, hasItinerary = true, days = 5): MapCountry => ({ slug, name: slug, flag: '🏳️', stats: { hasItinerary, totalDays: days, totalActivities: 9 } });

test('project: the equator/meridian sit in the middle, edges are clamped', () => {
  assert.deepEqual(project(0, 0).left, 50);
  assert.ok(Math.abs(project(0, 0).top - (84 / 142) * 100) < 1e-9);
  assert.deepEqual(project(90, 200), { left: 100, top: 0 });
  assert.deepEqual(project(-90, -200), { left: 0, top: 100 });
});

test('Tokyo lands in the east of the map, north of the equator', () => {
  const p = project(...PIN_COORDS.japan);
  assert.ok(p.left > 85 && p.left < 95);
  assert.ok(p.top < 55);
});

test('every pin coordinate is a real latitude / longitude', () => {
  for (const [slug, [lat, lon]] of Object.entries(PIN_COORDS)) {
    assert.ok(lat >= -58 && lat <= 84 && lon >= -180 && lon <= 180, slug);
  }
});

test('placePins: planned trips first, unknown countries stay unplaced', () => {
  const { pins, unplaced } = placePins([c('france', false), c('japan'), c('atlantis')]);
  assert.deepEqual(pins.map((p) => p.slug), ['japan', 'france']);
  assert.deepEqual(unplaced.map((u) => u.slug), ['atlantis']);
  assert.equal(pins[0].days, 5);
  assert.equal(placePins([c('japan', true, Number.NaN)]).pins[0].days, 0);
});

test('the committed map file exists and has the size the pins assume', () => {
  const svg = readFileSync(new URL('../public/world-map.svg', import.meta.url), 'utf8');
  assert.match(svg, /viewBox="0 0 720 284"/);
  assert.match(svg, /<path d="M/);
});
