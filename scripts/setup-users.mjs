#!/usr/bin/env node
// Creates the hidden `_users` and `_audit` worksheets (with headers) in your Google Spreadsheet.
// Optional: pass an email to register the first editor as active.
//   npm run sheets:setup                       # just create the tabs
//   npm run sheets:setup -- you@gmail.com      # also add you as an active editor
import { appendSheetRow, ensureHiddenTab, readSheetRows } from '../src/utils/googleSheets.ts';
import { AUDIT_HEADERS, USER_HEADERS, findUserByEmail, parseUserRows } from '../src/utils/userTable.ts';

const email = (process.argv[2] ?? '').trim().toLowerCase();
if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error(`❌ "${email}" is not a valid email address`);
  process.exit(1);
}

try {
  await ensureHiddenTab('_users', USER_HEADERS);
  await ensureHiddenTab('_audit', AUDIT_HEADERS);
  console.log('✅ Hidden tabs ready: _users, _audit');

  if (email) {
    const { users } = parseUserRows(await readSheetRows('_users', 'G'));
    if (findUserByEmail(users, email)) {
      console.log(`ℹ️  ${email} is already in _users`);
    } else {
      // google_id, email, name, picture_url, status, created_at, last_login
      await appendSheetRow('_users', ['', email, '', '', 'active', new Date().toISOString(), '']);
      console.log(`✅ Added ${email} as an active editor (google_id and picture fill in at first sign-in)`);
    }
  } else {
    console.log('Next: add rows to _users (email + status "active"), or run: npm run sheets:setup -- you@gmail.com');
  }
  console.log('Tabs are hidden: in Google Sheets use the "All sheets" menu (bottom-left) to show them.');
} catch (err) {
  console.error('❌ Could not set up the tabs:', err instanceof Error ? err.message : err);
  console.error('Check GOOGLE_SHEET_ID / credentials and that the service account is an Editor on the sheet.');
  process.exit(1);
}
