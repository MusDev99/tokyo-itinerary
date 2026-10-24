// Pure helpers for the hidden `_users` worksheet (no imports: unit-tested with `node --test`).
// Columns: google_id, email, name, picture_url, status, created_at, last_login.
// The admin pre-registers a person by adding a row with just `email` and `status` = active.

export const USER_HEADERS = ['google_id', 'email', 'name', 'picture_url', 'status', 'created_at', 'last_login'] as const;
export type UserColumn = (typeof USER_HEADERS)[number];

export interface UserRecord {
  /** 1-based sheet row, used to update the row after login */
  rowNumber: number;
  googleId: string;
  email: string;
  name: string;
  picture: string;
  status: string;
  createdAt: string;
  lastLogin: string;
}

const norm = (v: unknown) => String(v ?? '').trim();
const key = (v: unknown) => norm(v).toLowerCase().replace(/[\s-]+/g, '_');

/** Reads the sheet rows (row 1 = headers, in any order) into user records; rows without an email are skipped. */
export function parseUserRows(rows: string[][] | null | undefined): { headers: string[]; users: UserRecord[] } {
  if (!rows || rows.length === 0) return { headers: [], users: [] };
  const headers = rows[0].map(key);
  const idx = (name: UserColumn) => headers.indexOf(name);
  const users: UserRecord[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const cell = (name: UserColumn) => (idx(name) >= 0 ? norm(row[idx(name)]) : '');
    const email = cell('email').toLowerCase();
    if (!email) continue;
    users.push({
      rowNumber: r + 1,
      googleId: cell('google_id'),
      email,
      name: cell('name'),
      picture: cell('picture_url'),
      status: cell('status').toLowerCase(),
      createdAt: cell('created_at'),
      lastLogin: cell('last_login'),
    });
  }
  return { headers, users };
}

export function findUserByEmail(users: UserRecord[], email: string): UserRecord | null {
  const wanted = norm(email).toLowerCase();
  return users.find((u) => u.email === wanted) ?? null;
}

/** Only an explicit "active" status can sign in; blank, "disabled", "pending" etc. cannot. */
export function isActiveUser(user: UserRecord | null | undefined): user is UserRecord {
  return !!user && user.status === 'active';
}

/**
 * First login links the Google account id to the row. After that the id must match,
 * so a different Google account can't take over a pre-registered email (A07).
 */
export function canLinkGoogleId(user: UserRecord, sub: string): boolean {
  return !user.googleId || user.googleId === sub;
}

/** Builds a full row in the sheet's own column order, keeping the existing values of columns we don't touch. */
export function userRow(headers: string[], values: Partial<Record<UserColumn, string>>, existing: string[] = []): string[] {
  const width = Math.max(headers.length, USER_HEADERS.length);
  const row = Array.from({ length: width }, (_, i) => existing[i] ?? '');
  headers.forEach((h, i) => {
    if (h in values) row[i] = values[h as UserColumn] ?? '';
  });
  return row;
}

export const AUDIT_HEADERS = ['time', 'email', 'action', 'tab', 'target'] as const;

/** Sheet-safe audit values: single line, bounded, formula-neutral. */
export function auditRow(e: { email: string; action: string; tab?: string; target?: string }, nowIso = new Date().toISOString()): string[] {
  const clean = (v: unknown, max: number) => {
    const s = String(v ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
    return /^[=+\-@]/.test(s) ? `'${s}` : s;
  };
  return [nowIso, clean(e.email, 200), clean(e.action, 40), clean(e.tab, 100), clean(e.target, 200)];
}
