/** Currency helpers that work for any ISO 4217 code (no hardcoded lists). */

const names = typeof Intl !== 'undefined' && 'DisplayNames' in Intl ? new Intl.DisplayNames(['en'], { type: 'currency' }) : null;

export function currencyName(code: string): string {
  try {
    return names?.of(code) || code;
  } catch {
    return code;
  }
}

export function currencySymbol(code: string): string {
  try {
    const part = new Intl.NumberFormat('en-US', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0)
      .find((p) => p.type === 'currency');
    return part?.value || code;
  } catch {
    return code;
  }
}

/** Always MYR and USD, then any currency used by an existing itinerary (deduplicated, in order). */
export function buildHubCurrencies(tripCurrencies: string[] = []): string[] {
  const out: string[] = [];
  for (const code of ['MYR', 'USD', ...tripCurrencies]) {
    const c = String(code || '').trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(c) && !out.includes(c)) out.push(c);
  }
  return out;
}

export function formatMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}
