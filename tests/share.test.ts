import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateSpan, summaryLine, shareMessage, whatsappUrl, shareDescription } from '../src/utils/share.ts';

test('date span: same month, same year, across years, single day, nothing', () => {
  assert.equal(dateSpan('2025-03-01', '2025-03-07'), '1–7 Mar 2025');
  assert.equal(dateSpan('2025-02-28', '2025-03-03'), '28 Feb – 3 Mar 2025');
  assert.equal(dateSpan('2025-12-30', '2026-01-03'), '30 Dec 2025 – 3 Jan 2026');
  assert.equal(dateSpan('2025-03-01', '2025-03-01'), '1 Mar 2025');
  assert.equal(dateSpan('2025-03-01'), '1 Mar 2025');
  assert.equal(dateSpan(undefined, '2025-03-01'), '');
  assert.equal(dateSpan('nonsense', '2025-03-01'), '');
});

test('summary line skips missing parts and does not repeat the country', () => {
  assert.equal(summaryLine({ cities: 'Tokyo → Osaka', country: 'Japan', start: '2025-03-01', end: '2025-03-07', days: 7 }), 'Tokyo → Osaka · Japan · 1–7 Mar 2025 · 7 days');
  assert.equal(summaryLine({ cities: 'Japan', country: 'Japan', days: 1 }), 'Japan · 1 day');
  assert.equal(summaryLine({ days: 0 }), '');
});

test('share message: bold title, summary, blank line, link; stars in the title cannot break the bold', () => {
  const msg = shareMessage({ title: 'AirTravel *Japan* 2025', cities: 'Tokyo → Osaka', country: 'Japan', start: '2025-03-01', end: '2025-03-07', days: 7, url: 'https://plantravel.example/trips/x/share' });
  assert.equal(msg, '✈️ *AirTravel Japan 2025*\nTokyo → Osaka · Japan · 1–7 Mar 2025 · 7 days\n\nFull day-by-day itinerary: https://plantravel.example/trips/x/share');
  const bare = shareMessage({ title: 'Trip', days: 0, url: 'https://x/y' });
  assert.equal(bare, '✈️ *Trip*\n\nFull day-by-day itinerary: https://x/y');
});

test('WhatsApp link encodes the text; a phone number is used only when it looks like one', () => {
  assert.equal(whatsappUrl('hi there & more'), 'https://wa.me/?text=hi%20there%20%26%20more');
  assert.equal(whatsappUrl('x', '+60 12-345 6789'), 'https://wa.me/60123456789?text=x');
  assert.equal(whatsappUrl('x', '12'), 'https://wa.me/?text=x');
  assert.equal(whatsappUrl('x', 'abc'), 'https://wa.me/?text=x');
  assert.ok(!whatsappUrl('a\nb').includes('\n'));
});

test('preview description', () => {
  assert.match(shareDescription({ cities: 'Tokyo', start: '2025-03-01', end: '2025-03-03', days: 3 }), /^Tokyo · 1–3 Mar 2025 · 3 days\. Day-by-day/);
  assert.equal(shareDescription({ days: 0 }), 'Day-by-day itinerary with maps and times.');
});
