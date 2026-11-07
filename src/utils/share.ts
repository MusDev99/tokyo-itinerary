/**
 * Sharing a trip (pure, unit-tested): the WhatsApp message, the wa.me link and the date span used in previews.
 * The shared link points at the client page (`/trips/<slug>/share`): clean, read-only, no editing controls.
 */
import { parseIso } from './calendar.ts';

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions): string => {
  const p = parseIso(iso);
  return p ? new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: 'UTC' }).format(new Date(Date.UTC(p.year, p.month, p.day))) : '';
};

/** "1–7 Mar 2025", "28 Feb – 3 Mar 2025", "30 Dec 2025 – 3 Jan 2026" or a single day; '' without a start. */
export function dateSpan(start?: string, end?: string): string {
  if (!start || !parseIso(start)) return '';
  const full = (iso: string) => fmt(iso, { day: 'numeric', month: 'short', year: 'numeric' });
  if (!end || !parseIso(end) || end === start) return full(start);
  const a = parseIso(start)!;
  const b = parseIso(end)!;
  if (a.year === b.year && a.month === b.month) return `${a.day}–${b.day} ${fmt(start, { month: 'short' })} ${a.year}`;
  if (a.year === b.year) return `${fmt(start, { day: 'numeric', month: 'short' })} – ${full(end)}`;
  return `${full(start)} – ${full(end)}`;
}

export interface ShareInfo {
  title: string;
  /** "Tokyo → Osaka" */
  cities?: string;
  country?: string;
  start?: string;
  end?: string;
  days: number;
  /** Absolute address of the client page */
  url: string;
}

/** "Tokyo → Osaka · Japan · 1–7 Mar 2025 · 7 days" (parts that are missing are skipped). */
export function summaryLine(i: Pick<ShareInfo, 'cities' | 'country' | 'start' | 'end' | 'days'>): string {
  const where = [i.cities, i.country && !(i.cities ?? '').includes(i.country) ? i.country : ''].filter(Boolean).join(' · ');
  return [where, dateSpan(i.start, i.end), i.days > 0 ? `${i.days} ${i.days === 1 ? 'day' : 'days'}` : ''].filter(Boolean).join(' · ');
}

/** The message people send: a bold title (WhatsApp *bold*), one summary line and the link. */
export function shareMessage(i: ShareInfo): string {
  const title = i.title.replace(/\*/g, '').trim();
  return [`✈️ *${title}*`, summaryLine(i), '', `Full day-by-day itinerary: ${i.url}`].filter((l, idx) => l !== '' || idx === 2).join('\n').replace(/\n{3,}/g, '\n\n');
}

/** Open WhatsApp with the text ready to send; with `phone` (digits, country code) it opens that chat. */
export function whatsappUrl(text: string, phone?: string): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  const base = digits.length >= 8 && digits.length <= 15 ? `https://wa.me/${digits}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(text)}`;
}

/** Description for link previews (WhatsApp, iMessage...): the summary line, or a generic sentence. */
export function shareDescription(i: Pick<ShareInfo, 'cities' | 'country' | 'start' | 'end' | 'days'>): string {
  const line = summaryLine(i);
  return line ? `${line}. Day-by-day itinerary with maps and times.` : 'Day-by-day itinerary with maps and times.';
}
