import { AUDIT_HEADERS, USER_HEADERS, auditRow, canLinkGoogleId, findUserByEmail, isActiveUser, parseUserRows, userRow, type UserRecord } from './userTable';
import { appendSheetRow, ensureHiddenTab, readSheetRows, updateSheetRow } from './googleSheets';
import type { GoogleProfile } from './auth';

const USERS_TAB = '_users';
const AUDIT_TAB = '_audit';
const CACHE_MS = 60_000; // Sheets allows ~60 reads/min: re-check access at most once a minute

const g = globalThis as unknown as {
  __USERS_CACHE__?: { at: number; headers: string[]; users: UserRecord[] };
  __AUDIT_READY__?: boolean;
};

async function loadUsers(force = false) {
  const now = Date.now();
  if (!force && g.__USERS_CACHE__ && now - g.__USERS_CACHE__.at < CACHE_MS) return g.__USERS_CACHE__;
  let rows = await readSheetRows(USERS_TAB, 'G');
  if (!rows) {
    // First run: create the hidden tab so the admin sees the columns to fill in
    await ensureHiddenTab(USERS_TAB, USER_HEADERS).catch((err) =>
      console.error('[users] could not create the _users tab:', err instanceof Error ? err.message : err)
    );
    rows = [[...USER_HEADERS]];
  }
  const { headers, users } = parseUserRows(rows);
  g.__USERS_CACHE__ = { at: now, headers: headers.length ? headers : [...USER_HEADERS], users };
  return g.__USERS_CACHE__;
}

/** The active registered user for an email, or null (unregistered / disabled). Cached for a minute. */
export async function findActiveUser(email: string): Promise<UserRecord | null> {
  const { users } = await loadUsers();
  const user = findUserByEmail(users, email);
  return isActiveUser(user) ? user : null;
}

export type LoginResult =
  | { ok: true; user: UserRecord }
  | { ok: false; reason: 'not-registered' | 'google-id-mismatch' };

/** Called after a verified Google login: checks registration, links the Google id on first use, refreshes the profile. */
export async function registerLogin(profile: GoogleProfile): Promise<LoginResult> {
  const { headers, users } = await loadUsers(true);
  const user = findUserByEmail(users, profile.email);
  if (!isActiveUser(user)) return { ok: false, reason: 'not-registered' };
  if (!canLinkGoogleId(user, profile.sub)) return { ok: false, reason: 'google-id-mismatch' };

  const now = new Date().toISOString();
  const updated = { ...user, googleId: profile.sub, name: profile.name || user.name, picture: profile.picture || user.picture, lastLogin: now, createdAt: user.createdAt || now };
  try {
    const fresh = await readSheetRows(USERS_TAB, 'G');
    const current = fresh?.[user.rowNumber - 1] ?? [];
    await updateSheetRow(
      USERS_TAB,
      user.rowNumber,
      userRow(headers, { google_id: updated.googleId, name: updated.name, picture_url: updated.picture, created_at: updated.createdAt, last_login: updated.lastLogin }, current)
    );
    g.__USERS_CACHE__ = undefined;
  } catch (err) {
    console.error('[users] could not update the user row:', err instanceof Error ? err.message : err);
  }
  return { ok: true, user: updated };
}

/** Who changed what. Best-effort: a failed audit write never blocks the edit itself. */
export async function recordAudit(entry: { email: string; action: string; tab?: string; target?: string }): Promise<void> {
  try {
    if (!g.__AUDIT_READY__) {
      await ensureHiddenTab(AUDIT_TAB, AUDIT_HEADERS);
      g.__AUDIT_READY__ = true;
    }
    await appendSheetRow(AUDIT_TAB, auditRow(entry));
  } catch (err) {
    console.error('[audit] could not record entry:', err instanceof Error ? err.message : err);
  }
}
