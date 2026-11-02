import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startsPageLoad } from '../src/utils/navLoading.ts';

const here = 'https://plantravel.test/japan/tokyo/overview';

test('a plain click on another page of the site starts a page load', () => {
  assert.equal(startsPageLoad({ href: 'https://plantravel.test/japan/tokyo/analysis' }, here), true);
  assert.equal(startsPageLoad({ href: '/japan/tokyo?day=2' }, here), true);
  assert.equal(startsPageLoad({ href: '/' }, here), true);
  // Same path, different query: a new page
  assert.equal(startsPageLoad({ href: '/japan/tokyo/overview?x=1' }, here), true);
});

test('new tabs, modifier clicks and handled clicks do not', () => {
  const href = '/japan/tokyo/tools';
  assert.equal(startsPageLoad({ href, target: '_blank' }, here), false);
  assert.equal(startsPageLoad({ href, target: '_self' }, here), true);
  assert.equal(startsPageLoad({ href, modifier: true }, here), false);
  assert.equal(startsPageLoad({ href, button: 1 }, here), false);
  assert.equal(startsPageLoad({ href, handled: true }, here), false);
  assert.equal(startsPageLoad({ href, download: true }, here), false);
});

test('other sites, other schemes and in-page anchors do not', () => {
  assert.equal(startsPageLoad({ href: 'https://maps.google.com/?q=tokyo' }, here), false);
  assert.equal(startsPageLoad({ href: 'webcal://plantravel.test/japan/tokyo/calendar.ics' }, here), false);
  assert.equal(startsPageLoad({ href: 'mailto:a@b.c' }, here), false);
  assert.equal(startsPageLoad({ href: '#day-2' }, here), false);
  assert.equal(startsPageLoad({ href: 'not a url' }, 'also not a url'), false);
});

test('API routes and files do not (they never unload the page)', () => {
  assert.equal(startsPageLoad({ href: '/api/auth/google' }, here), false);
  assert.equal(startsPageLoad({ href: '/japan/tokyo/calendar.ics' }, here), false);
  assert.equal(startsPageLoad({ href: '/sitemap.xml' }, here), false);
});
