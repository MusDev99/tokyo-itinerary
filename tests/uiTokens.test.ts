import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// UI standard gate: status colours and the smallest text size come from tokens (global.css / tailwind.config.mjs),
// so every season and night theme recolours them together.
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(tsx|astro|ts)$/.test(n) ? [p] : [];
  });
}
const sources = files('src').map((f) => ({ f, s: readFileSync(f, 'utf8') }));

test('no raw red/emerald/amber/rose utilities (use danger / success / warning)', () => {
  const re = /\b(?:text|bg|border|ring|from|to|via)-(?:red|rose|emerald|amber)-\d{2,3}/;
  const bad = sources.filter(({ s }) => re.test(s)).map(({ f }) => f);
  assert.deepEqual(bad, []);
});

test('no text below 11px (use text-micro)', () => {
  const bad = sources.filter(({ s }) => /text-\[(?:[1-9]|10)px\]/.test(s)).map(({ f }) => f);
  assert.deepEqual(bad, []);
});
