import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePocketItem, parsePocketRows, itemToRow, itemsForDay, sortItems, POCKET_HEADERS, type PocketItem,
} from '../src/utils/pocket.ts';

const flight = {
  kind: 'flight', title: 'GA 874', from: 'CGK', to: 'NRT',
  startDate: '2026-11-12', startTime: '08:40', endDate: '2026-11-12', endTime: '17:05',
  details: { airline: 'Garuda', seat: '23A', gate: 'B3', terminal: '3', junk: 'x' },
};

test('a valid flight parses and drops unknown detail keys', () => {
  const r = parsePocketItem(flight);
  assert.equal(r.errors, undefined);
  assert.deepEqual(r.value!.details, { airline: 'Garuda', seat: '23A', gate: 'B3', terminal: '3' });
});

test('flight needs number, route and departure date', () => {
  const r = parsePocketItem({ kind: 'flight' });
  assert.deepEqual(Object.keys(r.errors!).sort(), ['from', 'startDate', 'title', 'to']);
});

test('stay needs a name and check-in, and checkout cannot precede it', () => {
  assert.ok(parsePocketItem({ kind: 'stay', title: 'Hotel' }).errors!.startDate);
  const r = parsePocketItem({ kind: 'stay', title: 'Hotel', startDate: '2026-11-12', endDate: '2026-11-10' });
  assert.match(r.errors!.endDate, /before/);
});

test('bad kind, date, time and url are rejected', () => {
  assert.ok(parsePocketItem({ kind: 'x' }).errors!.kind);
  const r = parsePocketItem({ kind: 'doc', title: 'Visa', startDate: '2026-02-30', startTime: '25:00', url: 'javascript:alert(1)' });
  assert.deepEqual(Object.keys(r.errors!).sort(), ['startDate', 'startTime', 'url']);
});

test('doc kind is limited to the known list; notes keep colour and todo only for notes', () => {
  assert.ok(parsePocketItem({ kind: 'doc', title: 'a', details: { docKind: 'hack' } }).errors!.docKind);
  const note = parsePocketItem({ kind: 'note', title: 'Wifi', colour: 'green', todo: true, done: true }).value!;
  assert.equal(note.colour, 'green');
  assert.equal(note.done, true);
  const doc = parsePocketItem({ kind: 'doc', title: 'Visa', colour: 'green', todo: true }).value!;
  assert.equal(doc.colour, '');
  assert.equal(doc.todo, false);
});

test('strings are trimmed and capped', () => {
  const v = parsePocketItem({ kind: 'note', title: `  ${'a'.repeat(500)}  `, notes: 'b'.repeat(5000) }).value!;
  assert.equal(v.title.length, 200);
  assert.equal(v.notes.length, 2000);
});

const base = (o: Partial<PocketItem>): PocketItem => ({
  id: 'i', kind: 'flight', title: 't', startDate: '', startTime: '', endDate: '', endTime: '', from: '', to: '',
  ref: '', notes: '', url: '', colour: '', todo: false, done: false, details: {}, createdBy: '', createdAt: '', ...o,
});

test('rows round-trip and only the asked trip is returned', () => {
  const item = base({ ...parsePocketItem(flight).value!, id: 'abc', createdBy: 'a@b.c', createdAt: '2026-11-04' });
  const row = itemToRow('Japan - Tokyo', item);
  assert.equal(row.length, POCKET_HEADERS.length);
  const other = itemToRow('Japan - Osaka', { ...item, id: 'zzz' });
  const blank = new Array(POCKET_HEADERS.length).fill('');
  const parsed = parsePocketRows([[...POCKET_HEADERS], row, other, blank], 'japan - tokyo');
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].rowNumber, 2);
  assert.deepEqual(parsed[0].details, item.details);
  assert.equal(parsed[0].title, 'GA 874');
});

test('a corrupt details cell does not break reading', () => {
  const row = itemToRow('T', base({ id: 'x', kind: 'stay', title: 'H' }));
  row[15] = '{not json';
  assert.deepEqual(parsePocketRows([[...POCKET_HEADERS], row], 'T')[0].details, {});
});

test('itemsForDay: flights on departure and on a later arrival, stays on check-in and out', () => {
  const night = base({ id: 'f', kind: 'flight', startDate: '2026-11-12', startTime: '23:30', endDate: '2026-11-13', endTime: '06:10' });
  const stay = base({ id: 's', kind: 'stay', startDate: '2026-11-13', startTime: '15:00', endDate: '2026-11-15', endTime: '11:00' });
  const note = base({ id: 'n', kind: 'note', startDate: '2026-11-13' });
  const all = [night, stay, note];
  assert.deepEqual(itemsForDay(all, '2026-11-12').map((c) => c.variant), ['depart']);
  assert.deepEqual(itemsForDay(all, '2026-11-13').map((c) => c.variant), ['arrive', 'checkin']);
  assert.deepEqual(itemsForDay(all, '2026-11-15').map((c) => c.variant), ['checkout']);
  assert.deepEqual(itemsForDay(all, '2026-11-14'), []);
});

test('sortItems puts dated items first, by date then time', () => {
  const a = base({ id: 'a', title: 'a', startDate: '2026-11-13', startTime: '09:00' });
  const b = base({ id: 'b', title: 'b', startDate: '2026-11-12', startTime: '18:00' });
  const c = base({ id: 'c', title: 'c' });
  assert.deepEqual(sortItems([c, a, b]).map((x) => x.id), ['b', 'a', 'c']);
});
