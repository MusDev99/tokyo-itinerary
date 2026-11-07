import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPdfModel, formatMoney, hasCjk, pdfFileName, pdfSafe } from '../src/utils/tripPdf.ts';
import type { DayItinerary } from '../src/types/itinerary.ts';

const item = (over: Record<string, unknown> = {}) => ({ time: '09:00', title: 'Item', description: '', location: { name: '', mapsUrl: '' }, price: { amount: 0, currency: '' }, note: '', ...over }) as any;
const day = (n: number, date: string, items: any[], extra: Record<string, unknown> = {}): DayItinerary => ({ day: n, title: `Title ${n}`, date, items, ...extra }) as any;

const sample = (): DayItinerary[] => [
  day(1, '2025-03-01', [
    item({ time: '12:30', title: 'Ramen Ichiran', category: 'food', price: { amount: 1200, currency: 'JPY', notes: 'per person' } }),
    item({ time: '09:00', title: 'Senso-ji 浅草寺', category: 'sightseeing', location: { name: 'Asakusa', mapsUrl: 'https://maps.example/x' }, description: 'Old temple', note: 'Go early' }),
  ], { city: 'Tokyo' }),
  day(2, '2025-03-02', [
    item({ time: '', title: 'Castle', price: { amount: 600, currency: 'JPY' } }),
    item({ time: '18:00', title: 'Hotel bar', category: 'food', price: { amount: 30, currency: 'MYR' } }),
  ], { city: 'Osaka' }),
];

test('items are in time order with untimed ones last; day and trip facts are counted', () => {
  const m = buildPdfModel({ title: 'Japan 2025' }, sample());
  assert.deepEqual(m.days[0].items.map((i) => i.title), ['Senso-ji 浅草寺', 'Ramen Ichiran']);
  assert.deepEqual(m.days[1].items.map((i) => i.title), ['Hotel bar', 'Castle']);
  assert.equal(m.facts.find((f) => f.label === 'Days')!.value, '2');
  assert.equal(m.facts.find((f) => f.label === 'Places')!.value, '4');
  assert.equal(m.facts.find((f) => f.label === 'Cities')!.value, 'Tokyo → Osaka');
  assert.equal(m.subtitle, 'Tokyo → Osaka');
  assert.equal(m.dateRange, 'Sat, 1 Mar 2025 – Sun, 2 Mar 2025');
});

test('money is never added across currencies; the biggest currency leads', () => {
  const m = buildPdfModel({ title: 'T' }, sample());
  assert.deepEqual(m.totals.map((t) => t.text), ['1,800 JPY', '30 MYR']);
  assert.equal(m.facts.find((f) => f.label === 'Estimated cost')!.value, '1,800 JPY + 30 MYR');
  assert.equal(m.days[0].cost, '1,200 JPY');
  assert.equal(m.days[1].cost, '600 JPY + 30 MYR');
  assert.equal(m.days[0].items[1].price, '1,200 JPY (per person)');
  assert.equal(m.days[0].items[0].price, undefined, 'free items show no price');
});

test('prices without a currency take the trip currency; categories carry shares of the main currency', () => {
  const days = [day(1, '2025-03-01', [item({ title: 'Lunch', category: 'food', price: { amount: 300 } }), item({ title: 'Train', category: 'transport', price: { amount: 100 } })])];
  const m = buildPdfModel({ title: 'T', currency: 'JPY' }, days);
  assert.equal(m.totals[0].text, '400 JPY');
  assert.deepEqual(m.categories.map((c) => [c.label, c.share]), [['Food & Dining', 0.75], ['Transport & Transit', 0.25]]);
});

test('overview rows list the first highlights, places and cost per day', () => {
  const m = buildPdfModel({ title: 'T' }, sample());
  assert.equal(m.overview[0].highlights, 'Senso-ji 浅草寺 · Ramen Ichiran');
  assert.equal(m.overview[0].places, 2);
  assert.equal(m.overview[0].date, 'Sat, 1 Mar');
  assert.equal(m.overview[1].cost, '600 JPY + 30 MYR');
});

test('a default day title ("Day 3") is dropped, a real one kept', () => {
  const m = buildPdfModel({ title: 'T' }, [day(1, '2025-03-01', [item()], { title: 'Day 1' }), day(2, '2025-03-02', [item()], { title: 'Day trip to Fuji' })]);
  assert.equal(m.days[0].title, '');
  assert.equal(m.days[1].title, 'Day trip to Fuji');
});

test('an empty trip still builds (no crash) and a trip with explicit dates uses them', () => {
  const m = buildPdfModel({ title: 'Empty', start: '2025-03-01', end: '2025-03-07' }, []);
  assert.equal(m.days.length, 0);
  assert.equal(m.dateRange, 'Sat, 1 Mar 2025 – Fri, 7 Mar 2025');
  assert.equal(m.totals.length, 0);
  assert.equal(m.facts.find((f) => f.label === 'Estimated cost')!.value, '—');
});

test('Japanese text is detected so the PDF can load the CJK font', () => {
  assert.equal(buildPdfModel({ title: 'T' }, sample()).needsCjk, true);
  assert.equal(buildPdfModel({ title: 'T' }, [day(1, '2025-03-01', [item({ title: 'Ramen' })])]).needsCjk, false);
  assert.equal(hasCjk('渋谷'), true);
  assert.equal(hasCjk('ラーメン'), true);
  assert.equal(hasCjk('Café déjà vu'), false);
});

test('printable text: emoji dropped always; without the CJK font only Windows-1252 text survives', () => {
  assert.equal(pdfSafe('🍜 Ramen  Ichiran ✓', true), 'Ramen Ichiran');
  assert.equal(pdfSafe('Tokyo → Osaka', false), 'Tokyo > Osaka');
  assert.equal(pdfSafe('Café “quoted” – dash', false), 'Café “quoted” – dash');
  assert.equal(pdfSafe('Senso-ji 浅草寺', false), 'Senso-ji');
  assert.equal(pdfSafe('Senso-ji 浅草寺', true), 'Senso-ji 浅草寺');
  assert.equal(pdfSafe('', false), '');
});

test('file names are safe and fall back when the title has no usable letters', () => {
  assert.equal(pdfFileName('AirTravel Sdn Bhd Trip at Japan 2025'), 'airtravel-sdn-bhd-trip-at-japan-2025-itinerary.pdf');
  assert.equal(pdfFileName('東京旅行'), 'itinerary.pdf');
  assert.equal(pdfFileName('Café ../etc/passwd'), 'cafe-etc-passwd-itinerary.pdf');
  assert.ok(pdfFileName('x'.repeat(200)).length < 80);
  assert.equal(formatMoney(1234.5, 'JPY'), '1,234.5 JPY');
  assert.equal(formatMoney(NaN, ''), '0');
});
