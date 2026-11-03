// Pure helpers for the Overview tab: donut arc geometry and the per-day spending history. Dependency-free (tested).

export interface Arc {
  /** Length of the visible stroke, in the circle's own units */
  len: number;
  /** Where it starts along the circle (use as a negative dashoffset) */
  start: number;
  /** 0..1 share of the total */
  share: number;
}

/**
 * Lays slices around a circle of the given radius. With more than one slice, each is shortened by `gap` (the caller
 * passes the stroke width plus a hair, so rounded caps never touch). Zero or negative values get no slice.
 */
export function donutArcs(values: number[], radius: number, gap: number): { circumference: number; arcs: Arc[] } {
  const circumference = 2 * Math.PI * radius;
  const clean = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const sum = clean.reduce((a, v) => a + v, 0);
  if (sum <= 0) return { circumference, arcs: clean.map(() => ({ len: 0, start: 0, share: 0 })) };
  const visible = clean.filter((v) => v > 0).length;
  let at = 0;
  const arcs = clean.map((v) => {
    const share = v / sum;
    const slice = share * circumference;
    const g = visible > 1 ? gap : 0;
    const len = v > 0 ? Math.max(0.5, slice - g) : 0;
    const arc = { len, start: at + g / 2, share };
    at += slice;
    return arc;
  });
  return { circumference, arcs };
}

export interface SpendLine {
  id: string;
  dayKey: string;
  day: number;
  country: string;
  state?: string;
  date: string;
  time: string;
  title: string;
  description: string;
  note?: string;
  /** Amount in the home currency */
  converted: number;
  currency: string;
  amount: number;
  categoryKey: string;
}

export interface DayGroup {
  key: string;
  day: number;
  country: string;
  state?: string;
  /** "Sat, Oct 17" (or the sheet's own text when it isn't a readable date) */
  dateLabel: string;
  total: number;
  lines: SpendLine[];
}

/** "October 17, 2026" -> "Sat, Oct 17". Anything unreadable is returned as typed. */
export function shortDate(raw: string): string {
  const d = new Date(raw);
  if (!raw || isNaN(d.getTime())) return raw || '';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Groups paid lines by trip day, in itinerary order (the sheet reader already sorts each day by time). Free lines and
 * days with nothing paid are left out, so every group has a total above zero.
 */
export function groupSpendByDay(lines: SpendLine[]): DayGroup[] {
  const groups = new Map<string, DayGroup>();
  for (const l of lines) {
    if (!(l.converted > 0)) continue;
    let g = groups.get(l.dayKey);
    if (!g) {
      g = { key: l.dayKey, day: l.day, country: l.country, state: l.state, dateLabel: shortDate(l.date), total: 0, lines: [] };
      groups.set(l.dayKey, g);
    }
    g.total += l.converted;
    g.lines.push(l);
  }
  return [...groups.values()];
}
