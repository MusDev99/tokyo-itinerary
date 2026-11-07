import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legalConfig, contactLinks, LEGAL_UPDATED } from '../src/utils/legal.ts';

test('defaults: product name, no contact, no governing law, not reviewed (the draft notice shows)', () => {
  const c = legalConfig({});
  assert.deepEqual(c, { company: 'PlanTravel', email: '', whatsapp: '', governingLaw: '', reviewed: false });
  assert.deepEqual(contactLinks(c), []);
});

test('configured values are cleaned; only "1" marks the text as reviewed', () => {
  const c = legalConfig({ PUBLIC_COMPANY_NAME: '  Acme <b>Travel</b>\n Sdn Bhd ', PUBLIC_CONTACT_EMAIL: 'help@acme.example', ADMIN_WHATSAPP: '+60 12-345 6789', PUBLIC_GOVERNING_LAW: 'Malaysia', PUBLIC_LEGAL_REVIEWED: '1' });
  assert.equal(c.company, 'Acme b Travel /b Sdn Bhd');
  assert.equal(c.email, 'help@acme.example');
  assert.equal(c.whatsapp, '60123456789');
  assert.equal(c.governingLaw, 'Malaysia');
  assert.equal(c.reviewed, true);
  assert.equal(legalConfig({ PUBLIC_LEGAL_REVIEWED: 'true' }).reviewed, false);
  assert.deepEqual(contactLinks(c), [
    { label: 'help@acme.example', href: 'mailto:help@acme.example' },
    { label: 'WhatsApp +60123456789', href: 'https://wa.me/60123456789' },
  ]);
});

test('bad contact values are dropped instead of printed', () => {
  const c = legalConfig({ PUBLIC_CONTACT_EMAIL: 'not an email', ADMIN_WHATSAPP: '12' });
  assert.equal(c.email, '');
  assert.equal(c.whatsapp, '');
  assert.equal(legalConfig({ PUBLIC_COMPANY_NAME: 'x'.repeat(300) }).company.length, 80);
  assert.match(LEGAL_UPDATED, /^\d{4}-\d{2}-\d{2}$/);
});
