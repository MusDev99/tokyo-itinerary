import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesQuery, letterOf, groupByLetter, visibleItems, COLLAPSE_AFTER } from '../src/utils/countryList.ts';

test('search ignores case and accents and can match extra text', () => {
  assert.equal(matchesQuery('turk', 'Türkiye'), true);
  assert.equal(matchesQuery('TOKYO', 'Japan', 'Tokyo, Osaka'), true);
  assert.equal(matchesQuery('xyz', 'Japan'), false);
  assert.equal(matchesQuery('  ', 'Japan'), true);
});

test('letters, with # for symbols', () => {
  assert.equal(letterOf('Australia'), 'A');
  assert.equal(letterOf('Éire'), 'E');
  assert.equal(letterOf('1st Trip'), '#');
});

test('groups A-Z with # last and sorts inside', () => {
  const g = groupByLetter(['Japan', 'Australia', 'Austria', '9 Isles', 'China'], (x) => x);
  assert.deepEqual(g.map((x) => x.letter), ['A', 'C', 'J', '#']);
  assert.deepEqual(g[0].items, ['Australia', 'Austria']);
});

test('collapsed list shows the first N, a search shows all matches, Show all shows everything', () => {
  const items = Array.from({ length: 30 }, (_, i) => `Country ${i}`);
  const matches = (i: string, q: string) => matchesQuery(q, i);
  const base = { matches, showAll: false, query: '' };
  assert.deepEqual([visibleItems(items, base).shown.length, visibleItems(items, base).hidden], [COLLAPSE_AFTER, 30 - COLLAPSE_AFTER]);
  assert.equal(visibleItems(items, { ...base, showAll: true }).shown.length, 30);
  assert.equal(visibleItems(items, { ...base, query: 'country 2' }).shown.length, 11); // 2, 20-29
  assert.equal(visibleItems(items.slice(0, 5), base).hidden, 0);
});
