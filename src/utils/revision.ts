/**
 * Edit-conflict detection without a version column: a short fingerprint ("revision") of the fields a form edits.
 * The page carries the revision of what the person is looking at; the server recomputes it from the current row
 * right before writing. A mismatch means somebody else (or a direct edit in Google Sheets) changed it meanwhile.
 * Content-based on purpose: it also notices edits made in the spreadsheet itself, which a stored version would not.
 * Pure and dependency-free (unit-tested).
 */

/** FNV-1a, 32 bit: not cryptographic, only a change detector. */
export function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

const SEP = '␟'; // "symbol for unit separator": cannot be typed into a cell by accident

/** The sheet columns an activity form edits (order is part of the fingerprint). */
export const ACTIVITY_REVISION_COLUMNS = [
  'date', 'time', 'title', 'day_title', 'description', 'category', 'location_name',
  'price_amount', 'price_currency', 'price_notes', 'city',
] as const;

/** Revision of one activity row; `cell(column)` returns the trimmed raw cell ('' when the column is missing). */
export function activityRevision(cell: (column: (typeof ACTIVITY_REVISION_COLUMNS)[number]) => string): string {
  return fnv1a(ACTIVITY_REVISION_COLUMNS.map((c) => (cell(c) ?? '').trim()).join(SEP));
}

/** Revision of a Pocket item from its editable fields (key order does not matter). */
export function pocketRevision(item: Record<string, unknown>): string {
  const stable = (v: unknown): string => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return '{' + Object.keys(v as object).sort().map((k) => `${k}:${stable((v as any)[k])}`).join(',') + '}';
    }
    return Array.isArray(v) ? '[' + v.map(stable).join(',') + ']' : String(v ?? '');
  };
  const editable = ['kind', 'title', 'startDate', 'startTime', 'endDate', 'endTime', 'from', 'to', 'ref', 'notes', 'url', 'colour', 'todo', 'done', 'details'];
  return fnv1a(editable.map((k) => `${k}=${stable(item[k])}`).join(SEP));
}

/** Revision of a trip's editable settings: title, dates and cities. */
export function tripRevision(t: { title: string; start?: string; end?: string; stops?: Array<{ city: string; start: string; end: string }> }): string {
  const stops = [...(t.stops ?? [])].sort((a, b) => a.start.localeCompare(b.start)).map((s) => `${s.city.trim()}@${s.start}-${s.end}`).join(',');
  return fnv1a([t.title.trim(), t.start ?? '', t.end ?? '', stops].join(SEP));
}
