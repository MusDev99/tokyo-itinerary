// Pure helpers for the per-trip "Pocket" (hidden `_pocket` worksheet). No imports: unit-tested with `node --test`.
// Flights and stays carry dates so the itinerary can show them on the right day (read-only).

export const POCKET_TAB = '_pocket';
export const POCKET_HEADERS = [
  'id', 'trip_tab', 'kind', 'title', 'start_date', 'start_time', 'end_date', 'end_time',
  'from', 'to', 'ref', 'notes', 'url', 'colour', 'done', 'details', 'created_by', 'created_at',
] as const;
export const POCKET_LAST_COL = 'R';
export const MAX_POCKET_ITEMS = 100;

export type PocketKind = 'flight' | 'stay' | 'doc' | 'note';
export const POCKET_KINDS: readonly PocketKind[] = ['flight', 'stay', 'doc', 'note'];
export const DOC_KINDS = ['visa', 'passport', 'insurance', 'booking', 'other'] as const;
export const NOTE_COLOURS = ['yellow', 'green', 'blue', 'purple', 'pink'] as const;

/** Extra per-kind fields, stored as JSON in the `details` column (keeps the sheet readable). */
const DETAIL_KEYS: Record<PocketKind, readonly string[]> = {
  flight: ['airline', 'seat', 'gate', 'terminal'],
  stay: ['address'],
  doc: ['docKind'],
  note: [],
};

export interface PocketItem {
  id: string;
  kind: PocketKind;
  title: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  from: string;
  to: string;
  /** Confirmation / booking reference */
  ref: string;
  notes: string;
  /** https link to a file kept elsewhere (Drive, Photos...) */
  url: string;
  colour: string;
  /** To-do notes only */
  todo: boolean;
  done: boolean;
  details: Record<string, string>;
  createdBy: string;
  createdAt: string;
}

/** What the client may send: no id / owner / timestamps. */
export type PocketInput = Omit<PocketItem, 'id' | 'createdBy' | 'createdAt'>;

const s = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function isIsoDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

const isTime = (v: string) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(v);

/** https/http links only (same rule as `safeHttpUrl`, repeated here to stay import-free). */
export function cleanUrl(v: string): string | null {
  try {
    const u = new URL(v.trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export const isPocketKind = (v: unknown): v is PocketKind => POCKET_KINDS.includes(v as PocketKind);

/** Validates one item from the client. Returns the clean value, or a map of field errors. */
export function parsePocketItem(raw: any): { value?: PocketInput; errors?: Record<string, string> } {
  const errors: Record<string, string> = {};
  const kind = raw?.kind;
  if (!isPocketKind(kind)) return { errors: { kind: 'Pick a type' } };

  const title = s(raw?.title, 200);
  const startDate = s(raw?.startDate, 10);
  const endDate = s(raw?.endDate, 10);
  const startTime = s(raw?.startTime, 5);
  const endTime = s(raw?.endTime, 5);
  const from = s(raw?.from, 100);
  const to = s(raw?.to, 100);
  const url = s(raw?.url, 500);

  if (!title) errors.title = kind === 'flight' ? 'Add the flight number' : kind === 'stay' ? 'Add the place name' : 'Add a title';
  if (startDate && !isIsoDate(startDate)) errors.startDate = 'Use a valid date';
  if (endDate && !isIsoDate(endDate)) errors.endDate = 'Use a valid date';
  if (startTime && !isTime(startTime)) errors.startTime = 'Use HH:MM';
  if (endTime && !isTime(endTime)) errors.endTime = 'Use HH:MM';
  if (url && !cleanUrl(url)) errors.url = 'Use a link starting with https://';

  if (kind === 'flight') {
    if (!from) errors.from = 'Where from?';
    if (!to) errors.to = 'Where to?';
    if (!startDate) errors.startDate = errors.startDate || 'Pick the departure date';
  }
  if (kind === 'stay' && !startDate) errors.startDate = errors.startDate || 'Pick the check-in date';
  if (startDate && endDate && !errors.startDate && !errors.endDate && endDate < startDate) {
    errors.endDate = kind === 'stay' ? 'Check-out is before check-in' : 'Arrival is before departure';
  }

  const details: Record<string, string> = {};
  for (const k of DETAIL_KEYS[kind]) {
    const v = s(raw?.details?.[k], k === 'address' ? 300 : 60);
    if (v) details[k] = v;
  }
  if (kind === 'doc' && details.docKind && !DOC_KINDS.includes(details.docKind as any)) errors.docKind = 'Pick a type';

  const colour = NOTE_COLOURS.includes(raw?.colour) ? raw.colour : '';
  if (Object.keys(errors).length) return { errors };

  return {
    value: {
      kind,
      title,
      startDate,
      startTime,
      endDate,
      endTime,
      from: kind === 'flight' ? from : '',
      to: kind === 'flight' ? to : '',
      ref: s(raw?.ref, 60),
      notes: s(raw?.notes, 2000),
      url: url ? (cleanUrl(url) as string) : '',
      colour: kind === 'note' ? colour : '',
      todo: kind === 'note' && raw?.todo === true,
      done: kind === 'note' && raw?.todo === true && raw?.done === true,
      details,
    },
  };
}

/** Sheet row (same order as POCKET_HEADERS). */
export function itemToRow(tab: string, item: PocketItem): string[] {
  return [
    item.id, tab, item.kind, item.title, item.startDate, item.startTime, item.endDate, item.endTime,
    item.from, item.to, item.ref, item.notes, item.url, item.colour,
    item.todo ? (item.done ? 'done' : 'todo') : '',
    Object.keys(item.details).length ? JSON.stringify(item.details) : '',
    item.createdBy, item.createdAt,
  ];
}

function parseDetails(raw: string, kind: PocketKind): Record<string, string> {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    const out: Record<string, string> = {};
    for (const k of DETAIL_KEYS[kind]) if (typeof obj?.[k] === 'string') out[k] = obj[k].slice(0, 300);
    return out;
  } catch {
    return {};
  }
}

/** Items of one trip from the sheet rows. Blank (deleted) rows and other trips are skipped. */
export function parsePocketRows(rows: string[][] | null | undefined, tab: string): Array<PocketItem & { rowNumber: number }> {
  if (!rows || rows.length < 2) return [];
  const wanted = tab.trim().toLowerCase();
  const out: Array<PocketItem & { rowNumber: number }> = [];
  for (let r = 1; r < rows.length; r++) {
    const c = rows[r] || [];
    const id = String(c[0] ?? '').trim();
    const kind = String(c[2] ?? '').trim();
    if (!id || !isPocketKind(kind) || String(c[1] ?? '').trim().toLowerCase() !== wanted) continue;
    const flag = String(c[14] ?? '').trim();
    out.push({
      rowNumber: r + 1,
      id,
      kind,
      title: String(c[3] ?? ''),
      startDate: String(c[4] ?? ''),
      startTime: String(c[5] ?? ''),
      endDate: String(c[6] ?? ''),
      endTime: String(c[7] ?? ''),
      from: String(c[8] ?? ''),
      to: String(c[9] ?? ''),
      ref: String(c[10] ?? ''),
      notes: String(c[11] ?? ''),
      url: cleanUrl(String(c[12] ?? '')) || '',
      colour: NOTE_COLOURS.includes(c[13] as any) ? String(c[13]) : '',
      todo: flag === 'todo' || flag === 'done',
      done: flag === 'done',
      details: parseDetails(String(c[15] ?? ''), kind),
      createdBy: String(c[16] ?? ''),
      createdAt: String(c[17] ?? ''),
    });
  }
  return out;
}

/** Dated items first (by date, then time), undated last; stable by title. */
export function sortItems<T extends Pick<PocketItem, 'startDate' | 'startTime' | 'title'>>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (!!a.startDate !== !!b.startDate) return a.startDate ? -1 : 1;
    return (
      a.startDate.localeCompare(b.startDate) ||
      a.startTime.localeCompare(b.startTime) ||
      a.title.localeCompare(b.title)
    );
  });
}

export type DayVariant = 'depart' | 'arrive' | 'checkin' | 'checkout';
export interface DayCard {
  variant: DayVariant;
  time: string;
  item: PocketItem;
}

/**
 * Read-only cards the itinerary shows on a given ISO day:
 * flights on departure (and on arrival when it lands on a later day), stays on check-in and check-out.
 */
export function itemsForDay(items: PocketItem[], iso: string): DayCard[] {
  const cards: DayCard[] = [];
  for (const item of items) {
    if (item.kind === 'flight') {
      if (item.startDate === iso) cards.push({ variant: 'depart', time: item.startTime, item });
      if (item.endDate && item.endDate !== item.startDate && item.endDate === iso) {
        cards.push({ variant: 'arrive', time: item.endTime, item });
      }
    } else if (item.kind === 'stay') {
      if (item.startDate === iso) cards.push({ variant: 'checkin', time: item.startTime, item });
      if (item.endDate && item.endDate !== item.startDate && item.endDate === iso) {
        cards.push({ variant: 'checkout', time: item.endTime, item });
      }
    }
  }
  return cards.sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
}
