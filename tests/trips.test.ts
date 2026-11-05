import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseStops, serializeStops, parseTripMetas, legacyTripSlug, uniqueSlug, cityForDay, orderedCities, citiesLabel,
} from '../src/utils/trips.ts';

test('stops: valid ones are kept and sorted, malformed ones dropped, bad JSON is empty', () => {
  const raw = JSON.stringify([
    { city: 'Osaka', country: 'Japan', start: '2025-03-05', end: '2025-03-07' },
    { city: 'Tokyo', country: 'Japan', start: '2025-03-01', end: '2025-03-04' },
    { city: '', start: '2025-03-01', end: '2025-03-02' },
    { city: 'X', start: '2025-03-09', end: '2025-03-01' },
    { city: 'Y', start: 'soon', end: 'later' },
  ]);
  const stops = parseStops(raw);
  assert.deepEqual(stops.map((s) => s.city), ['Tokyo', 'Osaka']);
  assert.deepEqual(parseStops('{not json'), []);
  assert.deepEqual(parseStops(''), []);
  assert.equal(serializeStops([]), '');
  assert.deepEqual(parseStops(serializeStops(stops)), stops);
});

const HEADER = ['tab', 'place', 'admin1', 'country', 'country_code', 'lat', 'lng', 'timezone', 'start_date', 'end_date', 'title', 'slug', 'country', 'stops', 'created_by', 'created_at', 'copied_from'];

test('registry rows parse by header; place-only rows are skipped; the registry country is the K:Q one', () => {
  const stops = JSON.stringify([{ city: 'Tokyo', country: 'Japan', start: '2025-03-01', end: '2025-03-04' }]);
  const rows = [
    HEADER,
    ['AirTravel Japan 2025', 'Tokyo', '', 'Japan', 'JP', '35', '139', 'Asia/Tokyo', '2025-03-01', '2025-03-07', 'AirTravel Sdn Bhd Trip at Japan 2025', 'AirTravel Japan 2025!', 'Japan', stops, 'a@b.c', '2025-01-02', ''],
    ['Japan - Tokyo', 'Tokyo', '', 'Japan', 'JP', '35', '139', 'Asia/Tokyo', '', ''],
  ];
  const metas = parseTripMetas(rows);
  assert.equal(metas.length, 1);
  assert.equal(metas[0].slug, 'airtravel-japan-2025');
  assert.equal(metas[0].country, 'Japan');
  assert.equal(metas[0].title, 'AirTravel Sdn Bhd Trip at Japan 2025');
  assert.equal(metas[0].stops.length, 1);
  assert.deepEqual(parseTripMetas(null), []);
});

test('legacy slugs keep today\'s names so old links can be redirected', () => {
  assert.equal(legacyTripSlug('Japan', 'Tokyo'), 'japan-tokyo');
  assert.equal(legacyTripSlug('South Korea', 'Jeju Island'), 'south-korea-jeju-island');
  assert.equal(legacyTripSlug('korea', null), 'korea');
});

test('uniqueSlug: readable, deduplicated, never a reserved word', () => {
  assert.equal(uniqueSlug('AirTravel Sdn Bhd Trip at Japan 2025', []), 'airtravel-sdn-bhd-trip-at-japan-2025');
  assert.equal(uniqueSlug('Japan 2025', ['japan-2025']), 'japan-2025-2');
  assert.equal(uniqueSlug('Japan 2025', ['japan-2025', 'japan-2025-2']), 'japan-2025-3');
  assert.equal(uniqueSlug('Trips', []), 'trips-2');
  assert.equal(uniqueSlug('!!!', []), 'trip');
});

test('a day takes its own city, else the stop covering its date', () => {
  const stops = parseStops([
    { city: 'Tokyo', start: '2025-03-01', end: '2025-03-04' },
    { city: 'Osaka', start: '2025-03-05', end: '2025-03-07' },
  ]);
  assert.equal(cityForDay({ date: '2025-03-02' }, stops), 'Tokyo');
  assert.equal(cityForDay({ date: '2025-03-06' }, stops), 'Osaka');
  assert.equal(cityForDay({ date: '2025-03-06', city: 'Nara' }, stops), 'Nara');
  assert.equal(cityForDay({ date: '2025-04-01' }, stops), '');
});

test('cities in visiting order without repeats', () => {
  assert.deepEqual(orderedCities(['Tokyo', 'tokyo', 'Osaka', '', 'Tokyo']), ['Tokyo', 'Osaka']);
  assert.equal(citiesLabel(['Tokyo', 'Osaka']), 'Tokyo → Osaka');
  assert.equal(citiesLabel([]), '');
});
