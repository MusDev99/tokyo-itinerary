import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rowsToDayItinerary, liveRevision } from '../src/utils/googleSheets.ts';

// The page shows `rev` computed by the reader; the writer recomputes it from the live row (`liveRevision`).
// They MUST agree for an untouched row, whatever the header spelling or cell format, or every edit would "conflict".
const normalise = (h: string) => h.trim().toLowerCase().replace(/[\s-]+/g, '_');

function revsFromReader(rows: string[][]): string[] {
  return rowsToDayItinerary(rows, 'JPY', 'Japan - Tokyo').flatMap((d) => d.items.map((i) => i.rev ?? ''));
}
function revsFromWriter(rows: string[][]): string[] {
  const headers = rows[0].map(normalise);
  return rows.slice(1).filter((r) => r.some((c) => String(c).trim())).map((r) => liveRevision(headers, r));
}

test('reader and writer agree on the revision of untouched rows (canonical headers)', () => {
  const rows = [
    ['day', 'date', 'day_title', 'time', 'title', 'description', 'category', 'location_name', 'price_amount', 'price_currency', 'price_notes', 'id'],
    ['1', '2025-03-01', 'Arrival', '09:00', 'Senso-ji', 'Old temple', 'sightseeing', 'Asakusa', '0', 'JPY', '', 'a1'],
    ['1', '2025-03-01', '', '12:30', 'Ramen Ichiran', '', 'food', '', '1200', 'JPY', 'per person', 'a2'],
    ['2', '2025-03-02', 'Day trip', '', 'Fuji', '', '', 'Kawaguchiko', '', '', '', 'a3'],
  ];
  const r = revsFromReader(rows);
  assert.equal(r.length, 3);
  assert.deepEqual(r, revsFromWriter(rows));
  assert.equal(new Set(r).size, 3);
});

test('they also agree with alias headers, spreadsheet-formatted dates/times and padded cells', () => {
  const rows = [
    ['Day', 'Trip Date', 'Headline', 'Start Time', 'Activity', 'Details', 'Type', 'Venue', 'Cost', 'Currency', 'Cost-Notes', 'City', 'Row ID'],
    ['1', '46082', 'Arrival', '0.375', '  Senso-ji ', 'Old temple', 'sightseeing', 'Asakusa', '0', 'JPY', '', 'Tokyo', 'a1'],
    ['2', 'Mar 2, 2025', '', '9:00 AM', 'Fuji', '', '', '', '', '', '', 'Kawaguchiko', 'a2'],
  ];
  assert.deepEqual(revsFromReader(rows), revsFromWriter(rows));
});

test('editing any form field in the sheet changes the revision; editing an unedited column (note) does not', () => {
  const header = ['day', 'date', 'time', 'title', 'description', 'note', 'id'];
  const row = ['1', '2025-03-01', '09:00', 'Senso-ji', 'Old temple', 'bring cash', 'a1'];
  const base = revsFromWriter([header, row])[0];
  assert.notEqual(revsFromWriter([header, [...row.slice(0, 3), 'Senso-ji (new)', ...row.slice(4)]])[0], base);
  assert.notEqual(revsFromWriter([header, [...row.slice(0, 4), 'Different', ...row.slice(5)]])[0], base);
  assert.equal(revsFromWriter([header, [...row.slice(0, 5), 'bring more cash', 'a1']])[0], base);
});
