/**
 * What goes into a trip PDF (pure and unit-tested; drawing lives in pdfRender.ts).
 * The model answers "what would the traveller want on paper": the trip at a glance, a day table, what it costs
 * (by currency and by kind of spending, never adding yen to ringgit), then each day in time order with where to go
 * (a tappable map link), what to expect and the tips.
 */
import type { DayItinerary, TimelineItem } from '../types/itinerary.ts';
import { detectCategory } from './analytics.ts';
import { formatLongDate, toIsoDate } from './calendar.ts';

export interface PdfTripInfo {
  title: string;
  /** e.g. "Tokyo → Osaka · Japan" */
  subtitle?: string;
  start?: string;
  end?: string;
  /** Public address of the trip page (printed in the footer as a link) */
  url?: string;
  /** Used for prices that have no currency of their own */
  currency?: string;
  generated?: Date;
}

export interface PdfItem {
  time: string;
  title: string;
  category: string;
  categoryColor: string;
  location: string;
  mapsUrl?: string;
  description: string;
  price?: string;
  note?: string;
}

export interface PdfDay {
  /** "Day 3" */
  label: string;
  /** "Mon, 3 Mar 2025" */
  date: string;
  city: string;
  title: string;
  items: PdfItem[];
  cost?: string;
}

export interface Money { currency: string; amount: number; text: string }

export interface PdfModel {
  title: string;
  subtitle: string;
  dateRange: string;
  facts: Array<{ label: string; value: string }>;
  overview: Array<{ day: string; date: string; city: string; highlights: string; places: number; cost: string }>;
  totals: Money[];
  /** Spending by kind, largest first; `share` (0-1) is of the main currency's total */
  categories: Array<{ label: string; color: string; parts: Money[]; share: number }>;
  days: PdfDay[];
  url?: string;
  generated: string;
  /** Any Japanese / Chinese / Korean text: the PDF then needs the CJK font */
  needsCjk: boolean;
}

export function formatMoney(amount: number, currency: string): string {
  const n = Number.isFinite(amount) ? amount : 0;
  return `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}${currency ? ` ${currency}` : ''}`;
}

const CJK = /[⺀-鿿가-힯豈-﫿＀-￯　-〿]/;
export const hasCjk = (text: string): boolean => CJK.test(text);

const EMOJI = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}]/gu;
const WIN_ANSI_EXTRA = '‘’“”–—•…€™‹›‰†‡ƒˆ˜ŠšŽžŸŒœ';
const ASCII_REPLACEMENTS: Record<string, string> = { '→': '>', '←': '<', '↑': '^', '↓': 'v', '✓': '', '×': 'x', '・': '·', '～': '~', '〜': '~' };

/**
 * Text that the chosen font can print. With the CJK font everything but emoji stays; with the built-in Latin font
 * anything outside Windows-1252 is replaced or dropped, so a PDF never shows boxes or garbage.
 */
export function pdfSafe(text: string, cjkFont: boolean): string {
  let out = (text ?? '').replace(EMOJI, '').replace(/\s+/g, ' ').trim();
  if (cjkFont) return out;
  out = out.replace(/[→←↑↓✓×・～〜]/g, (c) => ASCII_REPLACEMENTS[c] ?? '');
  let safe = '';
  for (const ch of out) {
    const code = ch.codePointAt(0)!;
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.includes(ch)) safe += ch;
  }
  return safe.replace(/\s+/g, ' ').trim();
}

/** `my-trip-2025-itinerary.pdf`; falls back to `itinerary.pdf` when the title has no letters we can use in a file name. */
export function pdfFileName(title: string): string {
  const slug = (title || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return `${slug ? `${slug}-` : ''}itinerary.pdf`;
}

const shortDate = (iso: string): string => {
  const long = formatLongDate(iso);
  return long.replace(/ \d{4}$/, '');
};

function addTo(map: Map<string, number>, key: string, amount: number) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

const toMoney = (map: Map<string, number>): Money[] =>
  [...map.entries()].filter(([, a]) => a > 0).map(([currency, amount]) => ({ currency, amount, text: formatMoney(amount, currency) })).sort((a, b) => b.amount - a.amount);

export function buildPdfModel(info: PdfTripInfo, days: DayItinerary[]): PdfModel {
  const fallbackCurrency = info.currency ?? '';
  const totals = new Map<string, number>();
  const byCategory = new Map<string, { label: string; color: string; sums: Map<string, number> }>();
  const cities: string[] = [];
  let places = 0;

  const pdfDays: PdfDay[] = days.map((d) => {
    const city = d.city || d.state || '';
    if (city && !cities.includes(city)) cities.push(city);
    const dayTotals = new Map<string, number>();
    const items: PdfItem[] = [...d.items]
      .map((it: TimelineItem, i) => ({ it, i }))
      .sort((a, b) => (a.it.time || '99:99').localeCompare(b.it.time || '99:99') || a.i - b.i)
      .map(({ it }) => {
        places++;
        const cat = detectCategory(it);
        const amount = Number(it.price?.amount) || 0;
        const currency = (it.price?.currency || fallbackCurrency).trim();
        if (amount > 0) {
          addTo(totals, currency, amount);
          addTo(dayTotals, currency, amount);
          const row = byCategory.get(cat.key) ?? { label: cat.label, color: cat.color, sums: new Map() };
          addTo(row.sums, currency, amount);
          byCategory.set(cat.key, row);
        }
        const priceNote = it.price?.notes ? ` (${it.price.notes})` : '';
        return {
          time: it.time || '',
          title: it.title || it.location?.name || 'Untitled',
          category: cat.label,
          categoryColor: cat.color,
          location: it.location?.name && it.location.name !== it.title ? it.location.name : '',
          mapsUrl: it.location?.mapsUrl || undefined,
          description: it.description || '',
          price: amount > 0 ? `${formatMoney(amount, currency)}${priceNote}` : undefined,
          note: it.note || undefined,
        };
      });
    const iso = toIsoDate(d.date || '');
    const cost = toMoney(dayTotals).map((m) => m.text).join(' + ');
    // A day named just "Day 3" (the default) adds nothing next to the "Day 3" label
    const dayTitle = /^day\s*\d+$/i.test((d.title || '').trim()) ? '' : d.title || '';
    return { label: `Day ${d.day}`, date: iso ? formatLongDate(iso) : d.date || '', city, title: dayTitle, items, cost: cost || undefined };
  });

  const isoDates = pdfDays.map((_, i) => toIsoDate(days[i].date || '')).filter(Boolean).sort();
  const start = toIsoDate(info.start || '') || isoDates[0] || '';
  const end = toIsoDate(info.end || '') || isoDates[isoDates.length - 1] || '';
  const dateRange = start && end && start !== end ? `${formatLongDate(start)} – ${formatLongDate(end)}` : start ? formatLongDate(start) : '';

  const totalList = toMoney(totals);
  const main = totalList[0]?.currency;
  const mainTotal = totalList[0]?.amount ?? 0;
  const categories = [...byCategory.values()]
    .map((c) => ({ label: c.label, color: c.color, parts: toMoney(c.sums), share: main && mainTotal ? (c.sums.get(main) ?? 0) / mainTotal : 0 }))
    .sort((a, b) => b.share - a.share || b.parts.length - a.parts.length);

  const subtitle = info.subtitle ?? (cities.length ? cities.join(' → ') : '');
  const facts = [
    { label: 'Days', value: String(pdfDays.length) },
    { label: 'Places', value: String(places) },
    { label: cities.length > 1 ? 'Cities' : 'City', value: cities.join(' → ') || '—' },
    { label: 'Estimated cost', value: totalList.length ? totalList.map((m) => m.text).join(' + ') : '—' },
  ];

  const overview = pdfDays.map((d) => ({
    day: d.label.replace('Day ', ''),
    date: shortDate(toIsoDate(days[pdfDays.indexOf(d)].date || '')) || d.date,
    city: d.city,
    highlights: d.items.slice(0, 3).map((i) => i.title).join(' · '),
    places: d.items.length,
    cost: d.cost || '—',
  }));

  const generated = (info.generated ?? new Date()).toISOString().slice(0, 10);
  const allText = [info.title, subtitle, ...pdfDays.flatMap((d) => [d.title, d.city, ...d.items.flatMap((i) => [i.title, i.location, i.description, i.note ?? ''])])].join(' ');

  return {
    title: info.title,
    subtitle,
    dateRange,
    facts,
    overview,
    totals: totalList,
    categories,
    days: pdfDays,
    url: info.url,
    generated: formatLongDate(generated),
    needsCjk: hasCjk(allText),
  };
}
