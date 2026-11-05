import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, detectCategory } from '../src/utils/analytics.ts';

const key = (title: string, category?: string) => detectCategory({ title, category }).key;

test('the original five keep detecting as before', () => {
  assert.equal(key('Ramen dinner'), 'food');
  assert.equal(key('Shinkansen to Kyoto'), 'transport');
  assert.equal(key('Hotel check in'), 'lodging');
  assert.equal(key('Don Quijote'), 'shopping');
  assert.equal(key('Senso-ji temple'), 'sightseeing');
});

test('new types are detected, and an explicit category always wins', () => {
  assert.equal(key('Hilton Spa massage'), 'wellness');
  assert.equal(key('Rooftop cocktail'), 'nightlife');
  assert.equal(key('Surfing lesson'), 'adventure');
  assert.equal(key('Sunrise beach hike'), 'nature');
  assert.equal(key('Summer festival'), 'culture');
  assert.equal(key('Anything', 'nightlife'), 'nightlife');
});

test('short keywords match whole words only', () => {
  assert.equal(key('Old barn visit'.replace('visit', 'stop')), 'general');
  assert.equal(key('Ski jacket shop'), 'shopping'); // shopping still claims it first
  assert.equal(key('Skirt'), 'general');
});

test('every type has a unique, short first word for the chips and its own colours', () => {
  const firsts = Object.values(CATEGORIES).map((c) => c.label.split(' ')[0]);
  assert.equal(new Set(firsts).size, firsts.length);
  const colours = Object.values(CATEGORIES).map((c) => c.color);
  assert.equal(new Set(colours).size, colours.length);
});
