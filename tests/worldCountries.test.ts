import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORLD_COUNTRIES, flagOf, worldCountry } from '../src/utils/worldCountries.ts';

test('flags come from the ISO code', () => {
  assert.equal(flagOf('MY'), '🇲🇾');
  assert.equal(flagOf('us'), '🇺🇸');
});

test('the table has 120+ countries, unique slugs, valid currency codes and a real flag', () => {
  assert.ok(WORLD_COUNTRIES.length >= 120);
  assert.equal(new Set(WORLD_COUNTRIES.map((c) => c.slug)).size, WORLD_COUNTRIES.length);
  for (const c of WORLD_COUNTRIES) {
    assert.match(c.currency, /^[A-Z]{3}$/, c.name);
    assert.equal([...c.flag].length, 2, c.name);
  }
});

test('lookup by slug', () => {
  assert.deepEqual(worldCountry('new-zealand'), { name: 'New Zealand', slug: 'new-zealand', flag: '🇳🇿', currency: 'NZD' });
  assert.equal(worldCountry('atlantis'), undefined);
});
