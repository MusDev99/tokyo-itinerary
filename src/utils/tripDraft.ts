// Pure, dependency-free helpers for the trip wizard + day-first builder.
// Shared by the browser (TripWizard / TripBuilder) and the API so both apply the same rules.

export const TAB_FORBIDDEN = /[\[\]*?:\/\\'!]/;
export const TAB_RESERVED = new Set(['itinerary', 'add', 'api', '404', 'tools', 'prepare', 'pocket']);
export const TAB_SEPARATOR = ' - ';
export const MAX_TRIP_DAYS = 60;

export const slug = (v: string) =>
  v.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** First error for one name part ("Country" / "State / City"), or null. */
function checkPart(value: string, label: string): string | null {
  if (!value.trim()) return `${label} is required`;
  if (TAB_FORBIDDEN.test(value)) return "Can't contain [ ] * ? : / \\ ' !";
  if (value.includes(TAB_SEPARATOR)) return "Can't contain ' - '";
  const s = slug(value);
  if (!s) return 'Use at least one letter or number';
  if (TAB_RESERVED.has(s)) return 'That name is reserved';
  return null;
}

/** Same rules the server enforces for a `Country - State` tab. */
export function validateTripName(country: string, state: string): { country?: string; state?: string } {
  const errors: { country?: string; state?: string } = {};
  const c = checkPart(country, 'Country');
  const s = checkPart(state, 'State / City');
  if (c) errors.country = c;
  if (s) errors.state = s;
  if (!errors.country && !errors.state && `${country.trim()}${TAB_SEPARATOR}${state.trim()}`.length > 100) {
    errors.state = 'Country + state is too long';
  }
  return errors;
}

/** True for a real calendar date written YYYY-MM-DD. */
export function isIsoDate(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** Adds whole days to a YYYY-MM-DD date (UTC math, so DST never shifts the result). */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Whole days between two ISO dates (end - start). */
export function diffDays(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000);
}

/** Validates a trip date range; returns an error message or null. */
export function validateRange(start: string, end: string): string | null {
  if (!isIsoDate(start) || !isIsoDate(end)) return 'Pick a start and an end date';
  if (end < start) return 'The end date is before the start date';
  if (diffDays(start, end) + 1 > MAX_TRIP_DAYS) return `A trip can span at most ${MAX_TRIP_DAYS} days`;
  return null;
}

/** Every date from start to end inclusive (empty when the range is invalid). */
export function buildDays(start: string, end: string): string[] {
  if (validateRange(start, end)) return [];
  const n = diffDays(start, end) + 1;
  return Array.from({ length: n }, (_, i) => addDays(start, i));
}

/**
 * The day to open the builder on: the first trip day with no activity,
 * else the day after the last planned one, else the start date.
 */
export function nextFreeDay(days: string[], plannedDates: string[]): string {
  const planned = new Set(plannedDates);
  const free = days.find((d) => !planned.has(d));
  if (free) return free;
  const last = [...days, ...plannedDates].sort().pop();
  return last ? addDays(last, 1) : '';
}

/** "Day 3" fallback when a day has no title (titles are optional in the builder). */
export const dayLabel = (index: number, title?: string) => (title && title.trim()) || `Day ${index + 1}`;

/** Default time for a new place: the previous item's end, else 09:00 (HH:MM, 24h). */
export function suggestNextTime(prevTime?: string, prevDurationMin = 60): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(prevTime || '');
  if (!m) return '09:00';
  const total = Math.min(23 * 60 + 30, Number(m[1]) * 60 + Number(m[2]) + prevDurationMin);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
