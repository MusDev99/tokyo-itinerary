/**
 * The traveller's clock (browser only). Dev builds accept `?today=2026-10-18T10:30` to preview any trip day;
 * the override is compiled out of production.
 */
export function deviceNow(): Date {
  if (import.meta.env.DEV) {
    const forced = new URLSearchParams(window.location.search).get('today');
    if (forced && !isNaN(new Date(forced).getTime())) return new Date(forced);
  }
  return new Date();
}
