// Server-side validation of one activity from the client (shared by /api/itinerary and /api/trips).
// No imports beyond a type: unit-tested with `node --test`.
import type { ActivityInput } from './googleSheets';

export const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Validates one activity; returns the clean record or a map of field errors. */
export function parseActivity(raw: any): { value?: ActivityInput; errors?: Record<string, string> } {
  const errors: Record<string, string> = {};
  const date = clean(raw?.date, 20);
  const title = clean(raw?.title, 200);
  const time = clean(raw?.time, 20);
  const dayTitle = clean(raw?.day_title, 200);

  if (!date || isNaN(new Date(date).getTime())) errors.date = 'Valid date is required';
  if (!title) errors.title = 'Title is required';

  let amount: number | null = null;
  if (raw?.price_amount !== undefined && raw?.price_amount !== null && raw?.price_amount !== '') {
    amount = Number(raw.price_amount);
    if (!Number.isFinite(amount) || amount < 0) errors.price_amount = 'Amount must be 0 or more';
  }

  const currency = clean(raw?.price_currency, 3).toUpperCase();
  if (currency && !/^[A-Z]{3}$/.test(currency)) errors.price_currency = 'Use a 3-letter currency code';

  if (Object.keys(errors).length) return { errors };

  return {
    value: {
      date,
      title,
      time,
      ...(dayTitle ? { day_title: dayTitle } : {}),
      description: clean(raw?.description, 2000),
      category: clean(raw?.category, 40),
      location_name: clean(raw?.location_name, 200),
      price_amount: amount,
      price_currency: currency,
      price_notes: clean(raw?.price_notes, 200),
      ...(typeof raw?.city === 'string' ? { city: clean(raw.city, 80) } : {}),
    },
  };
}
