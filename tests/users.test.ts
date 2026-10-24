import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditRow, canLinkGoogleId, findUserByEmail, isActiveUser, parseUserRows, userRow } from '../src/utils/userTable.ts';

const rows = [
  ['Email', 'google_id', 'Name', 'Picture URL', 'Status', 'created_at', 'last_login'],
  ['Admin@Example.com', '', '', '', 'Active', '', ''],
  ['linked@example.com', 'g-77', 'Lin', 'https://p/l.png', 'active', '2026-01-01', '2026-02-01'],
  ['off@example.com', '', '', '', 'disabled', '', ''],
  ['', 'g-1', 'no email', '', 'active', '', ''],
];

test('user rows are parsed by header name, emails are case-insensitive', () => {
  const { users, headers } = parseUserRows(rows);
  assert.equal(users.length, 3, 'rows without an email are skipped');
  assert.deepEqual(headers.slice(0, 3), ['email', 'google_id', 'name']);
  const admin = findUserByEmail(users, ' admin@example.com ');
  assert.equal(admin?.email, 'admin@example.com');
  assert.equal(admin?.rowNumber, 2);
  assert.equal(isActiveUser(admin), true);
  assert.equal(findUserByEmail(users, 'nobody@example.com'), null);
});

test('only an explicit active status can sign in', () => {
  const { users } = parseUserRows(rows);
  assert.equal(isActiveUser(findUserByEmail(users, 'off@example.com')), false);
  assert.equal(isActiveUser(null), false);
  assert.equal(isActiveUser({ ...users[0], status: '' }), false, 'blank status is not active');
});

test('google id is linked once and then must match', () => {
  const { users } = parseUserRows(rows);
  assert.equal(canLinkGoogleId(findUserByEmail(users, 'admin@example.com')!, 'g-new'), true, 'first login links');
  assert.equal(canLinkGoogleId(findUserByEmail(users, 'linked@example.com')!, 'g-77'), true);
  assert.equal(canLinkGoogleId(findUserByEmail(users, 'linked@example.com')!, 'g-other'), false, 'a different account cannot take over');
});

test('user row keeps the sheet column order and untouched cells', () => {
  const { headers } = parseUserRows(rows);
  const row = userRow(headers, { google_id: 'g-1', last_login: 'now' }, ['Admin@Example.com', '', '', '', 'Active', 'created', '']);
  assert.deepEqual(row, ['Admin@Example.com', 'g-1', '', '', 'Active', 'created', 'now']);
});

test('audit rows are single-line, bounded and formula-safe', () => {
  const r = auditRow({ email: 'a@b.co', action: 'update_activity', tab: 'Japan - Tokyo', target: '=HYPERLINK("x")\nsecond line' }, '2026-01-01T00:00:00.000Z');
  assert.equal(r[0], '2026-01-01T00:00:00.000Z');
  assert.ok(r[4].startsWith("'="), 'formula neutralised');
  assert.ok(!/[\r\n]/.test(r[4]));
  assert.equal(auditRow({ email: 'a@b.co', action: 'x', target: 'y'.repeat(999) })[4].length, 200);
});
