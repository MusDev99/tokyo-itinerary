/**
 * Draws a PdfModel (see tripPdf.ts) with jsPDF: cover, at-a-glance table, cost summary, then every day in time order
 * as a timeline. The caller loads jsPDF and the optional assets, so this file has no network or DOM access and runs
 * the same in the browser and in tests. Units are millimetres on A4 portrait.
 */
import type { PdfModel, PdfItem, PdfDay } from './tripPdf.ts';
import { pdfSafe } from './tripPdf.ts';

export interface PdfAssets {
  /** PNG data URL of the PlanTravel logo */
  logo?: string;
  /** TTF bytes of the CJK font (needed when the model has Japanese / Chinese / Korean text) */
  cjkFont?: ArrayBuffer;
}

const C = {
  teal: '#0E7490', tealDark: '#155E75', tealTint: '#ECFEFF', amber: '#F59E0B', amberTint: '#FFFBEB', amberInk: '#92400E',
  ink: '#0F172A', body: '#334155', muted: '#64748B', line: '#CBD5E1', card: '#F1F5F9', white: '#FFFFFF', link: '#0E7490',
};
const M = 16;            // side margin
const W = 210 - 2 * M;   // content width
const TOP = 24;          // first line below the running header
const BOTTOM = 276;      // last usable line above the footer

type Doc = any; // jsPDF instance (kept loose: the library is loaded on demand)

function base64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return typeof btoa === 'function' ? btoa(bin) : Buffer.from(bytes).toString('base64');
}

export function renderTripPdf(JsPdf: new (...a: any[]) => Doc, model: PdfModel, assets: PdfAssets = {}): Doc {
  const pdf: Doc = new JsPdf({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const cjk = Boolean(assets.cjkFont);
  if (assets.cjkFont) {
    pdf.addFileToVFS('NotoSansJP.ttf', base64(assets.cjkFont));
    pdf.addFont('NotoSansJP.ttf', 'NotoSansJP', 'normal', 'Identity-H');
  }
  const safe = (t: string) => pdfSafe(t, cjk);

  // ---- text helpers -------------------------------------------------------------------------------------------
  const setFont = (bold: boolean, italic = false) => {
    if (cjk) pdf.setFont('NotoSansJP', 'normal');
    else pdf.setFont('helvetica', bold && italic ? 'bolditalic' : bold ? 'bold' : italic ? 'italic' : 'normal');
  };
  interface TextOpts { size?: number; color?: string; bold?: boolean; italic?: boolean; align?: 'left' | 'right' | 'center'; link?: string }
  const text = (t: string, x: number, y: number, o: TextOpts = {}) => {
    const s = safe(t);
    if (!s) return;
    setFont(Boolean(o.bold), Boolean(o.italic));
    pdf.setFontSize(o.size ?? 10);
    pdf.setTextColor(o.color ?? C.body);
    // The CJK font has one weight: draw a thin outline to fake bold
    const faux = cjk && o.bold;
    if (faux) { pdf.setDrawColor(o.color ?? C.body); pdf.setLineWidth(0.18); }
    const opts: Record<string, unknown> = { align: o.align ?? 'left' };
    if (faux) opts.renderingMode = 'fillThenStroke';
    if (o.link) pdf.textWithLink(s, x, y, { ...opts, url: o.link });
    else pdf.text(s, x, y, opts);
  };
  const wrap = (t: string, width: number, size: number, bold = false, maxLines = 99): string[] => {
    const s = safe(t);
    if (!s) return [];
    setFont(bold);
    pdf.setFontSize(size);
    const lines: string[] = pdf.splitTextToSize(s, width);
    if (lines.length <= maxLines) return lines;
    const cut = lines.slice(0, maxLines);
    cut[maxLines - 1] = `${cut[maxLines - 1].replace(/\s+\S*$/, '')}…`;
    return cut;
  };
  const rect = (x: number, y: number, w: number, h: number, fill: string, r = 0) => {
    pdf.setFillColor(fill);
    r ? pdf.roundedRect(x, y, w, h, r, r, 'F') : pdf.rect(x, y, w, h, 'F');
  };

  let y = 0;
  const newPage = () => { pdf.addPage(); y = TOP; };
  const ensure = (h: number) => { if (y + h > BOTTOM) newPage(); };

  pdf.setProperties({ title: safe(model.title) || 'Itinerary', subject: 'Trip itinerary', creator: 'PlanTravel', author: 'PlanTravel' });

  // ---- cover --------------------------------------------------------------------------------------------------
  rect(0, 0, 210, 82, C.teal);
  rect(0, 82, 210, 2.5, C.amber);
  if (assets.logo) {
    try { pdf.addImage(assets.logo, 'PNG', M, 14, 17, 17); } catch { /* a bad logo must never block the PDF */ }
  }
  text('PlanTravel', M + 21, 24, { size: 17, bold: true, color: C.white });
  text('Travel & Expense Intelligence', M + 21, 29.5, { size: 8, color: '#CFFAFE' });

  const titleLines = wrap(model.title, W, 25, true, 3);
  let ty = 50;
  titleLines.forEach((l) => { text(l, M, ty, { size: 25, bold: true, color: C.white }); ty += 10.5; });
  if (model.subtitle) { text(model.subtitle, M, ty + 1, { size: 12.5, color: '#CFFAFE' }); ty += 7; }
  if (model.dateRange) text(model.dateRange, M, Math.min(ty + 3, 78), { size: 11, bold: true, color: '#FDE68A' });

  // fact cards (2 x 2)
  const cardW = (W - 6) / 2;
  let fy = 96;
  model.facts.forEach((f, i) => {
    const x = M + (i % 2) * (cardW + 6);
    if (i > 0 && i % 2 === 0) fy += 28;
    rect(x, fy, cardW, 23, C.card, 3);
    rect(x, fy, 1.6, 23, C.amber);
    text(f.label.toUpperCase(), x + 6, fy + 7, { size: 7.5, bold: true, color: C.muted });
    const valueLines = wrap(f.value, cardW - 10, f.value.length > 24 ? 10.5 : 14, true, 2);
    valueLines.forEach((l, j) => text(l, x + 6, fy + 15 + j * 5, { size: f.value.length > 24 ? 10.5 : 14, bold: true, color: C.ink }));
  });
  y = fy + 38;

  // ---- at a glance --------------------------------------------------------------------------------------------
  const heading = (t: string, sub?: string) => {
    ensure(18);
    text(t, M, y, { size: 14, bold: true, color: C.tealDark });
    setFont(true);
    pdf.setFontSize(14);
    const hw = pdf.getTextWidth(safe(t));
    rect(M, y + 2, 22, 1.2, C.amber);
    if (sub) text(sub, M + hw + 4, y, { size: 8.5, color: C.muted });
    y += 9;
  };

  if (model.overview.length) {
    heading('At a glance', `${model.days.length} ${model.days.length === 1 ? 'day' : 'days'}`);
    const col = { day: M + 3, date: M + 13, city: M + 40, hi: M + 66, places: M + W - 36, cost: M + W - 2 };
    const header = () => {
      rect(M, y - 4.5, W, 7, C.tealTint, 1.5);
      text('DAY', col.day, y, { size: 7, bold: true, color: C.tealDark });
      text('DATE', col.date, y, { size: 7, bold: true, color: C.tealDark });
      text('CITY', col.city, y, { size: 7, bold: true, color: C.tealDark });
      text('HIGHLIGHTS', col.hi, y, { size: 7, bold: true, color: C.tealDark });
      text('PLACES', col.places, y, { size: 7, bold: true, color: C.tealDark, align: 'right' });
      text('EST. COST', col.cost, y, { size: 7, bold: true, color: C.tealDark, align: 'right' });
      y += 6;
    };
    header();
    model.overview.forEach((r, i) => {
      const hiW = col.places - col.hi - 16;
      const hi = wrap(r.highlights, hiW, 8.5, false, 2);
      const costLines = wrap(r.cost, 30, 8.5, true, 2);
      const rows = Math.max(1, hi.length, costLines.length);
      const h = rows * 4.2 + 3;
      if (y + h > BOTTOM) { newPage(); header(); }
      if (i % 2 === 1) rect(M, y - 3.8, W, h, '#F8FAFC');
      text(r.day, col.day, y, { size: 9, bold: true, color: C.teal });
      text(r.date, col.date, y, { size: 8.5, color: C.body });
      text(r.city || '—', col.city, y, { size: 8.5, color: C.body });
      hi.forEach((l, j) => text(l, col.hi, y + j * 4.2, { size: 8.5, color: C.body }));
      text(String(r.places), col.places, y, { size: 8.5, color: C.body, align: 'right' });
      costLines.forEach((l, j) => text(l, col.cost, y + j * 4.2, { size: 8.5, bold: true, color: C.ink, align: 'right' }));
      y += h;
    });
    y += 6;
  }

  // ---- costs --------------------------------------------------------------------------------------------------
  if (model.totals.length) {
    // The whole section (heading, total, breakdown) stays together on one page
    ensure(9 + 18 + (model.totals.length > 1 ? 6 : 0) + model.categories.length * 6.5 + 4);
    heading('What it costs', 'estimates from the places in this plan');
    const totalLine = model.totals.map((t) => t.text).join('  +  ');
    rect(M, y - 5, W, 14, C.amberTint, 3);
    rect(M, y - 5, 1.6, 14, C.amber);
    text('ESTIMATED TOTAL', M + 6, y, { size: 7.5, bold: true, color: C.amberInk });
    text(totalLine, M + 6, y + 6, { size: 13, bold: true, color: C.ink });
    y += 18;
    if (model.totals.length > 1) {
      text('Amounts in different currencies are shown separately, not converted.', M, y, { size: 8, italic: true, color: C.muted });
      y += 6;
    }
    const barX = M + 58;
    const barMax = W - 58 - 44;
    model.categories.forEach((c) => {
      rect(M, y - 3, 2.6, 2.6, c.color, 1);
      text(c.label.replace(' & ', ' & '), M + 5, y, { size: 8.5, color: C.body });
      rect(barX, y - 3, barMax, 2.6, '#E2E8F0', 1.3);
      if (c.share > 0) rect(barX, y - 3, Math.max(1.5, barMax * c.share), 2.6, c.color, 1.3);
      text(c.parts.map((p) => p.text).join(' + '), M + W, y, { size: 8.5, bold: true, color: C.ink, align: 'right' });
      y += 6.5;
    });
    y += 4;
  }

  // ---- days ---------------------------------------------------------------------------------------------------
  const dayHeader = (d: PdfDay, cont = false) => {
    const title = safe(d.title);
    const h = title ? 15 : 10.5;
    rect(M, y - 6, W, h, C.tealTint, 2.5);
    rect(M, y - 6, 2, h, C.teal);
    const head = [d.label, d.date, d.city].filter(Boolean).join('  ·  ') + (cont ? '  (continued)' : '');
    text(head, M + 6, y, { size: 11, bold: true, color: C.tealDark });
    if (d.cost) text(d.cost, M + W - 3, y, { size: 8.5, bold: true, color: C.teal, align: 'right' });
    if (title) text(title, M + 6, y + 5.5, { size: 9, color: C.muted });
    y += h + 1; // first item's baseline sits just under the bar
  };

  const TIME_W = 16;
  const X0 = M + TIME_W + 9;
  const CW = W - TIME_W - 9;

  const itemBlock = (it: PdfItem) => {
    const titleL = wrap(it.title, CW, 10.5, true, 3);
    const descL = wrap(it.description, CW, 9, false, 14);
    const tipL = it.note ? wrap(it.note, CW - 10, 8.5, false, 6) : [];
    const loc = safe(it.location);
    let h = titleL.length * 4.8 + 4.5; // title + category line
    if (loc) h += 4.8;
    if (it.price) h += 4.8;
    if (descL.length) h += descL.length * 4.1 + 1;
    if (tipL.length) h += tipL.length * 3.9 + 6;
    return { titleL, descL, tipL, loc, h: h + 4 };
  };

  model.days.forEach((d, di) => {
    // Never leave a day header alone at the bottom of a page: it needs room for its first place too
    const firstH = d.items.length ? itemBlock(d.items[0]).h : 8;
    ensure(16 + firstH);
    if (di > 0) y += 4;
    dayHeader(d);
    if (!d.items.length) { text('Nothing planned yet.', X0, y, { size: 9, italic: true, color: C.muted }); y += 8; return; }
    d.items.forEach((it) => {
      const b = itemBlock(it);
      if (y - 4 + b.h > BOTTOM) { newPage(); y += 6; dayHeader(d, true); }
      const top = y - 4;
      // timeline: time, rail, dot
      text(it.time || '--:--', M + TIME_W, y, { size: 10, bold: true, color: it.time ? C.teal : C.line, align: 'right' });
      pdf.setDrawColor(C.line);
      pdf.setLineWidth(0.4);
      pdf.line(M + TIME_W + 4, top + 1, M + TIME_W + 4, top + b.h);
      pdf.setFillColor(C.amber);
      pdf.circle(M + TIME_W + 4, y - 1.3, 1.3, 'F');
      pdf.setFillColor(C.white);
      pdf.circle(M + TIME_W + 4, y - 1.3, 0.5, 'F');

      let yy = y;
      b.titleL.forEach((l) => { text(l, X0, yy, { size: 10.5, bold: true, color: C.ink }); yy += 4.8; });
      text(it.category.toUpperCase(), X0, yy - 0.6, { size: 6.5, bold: true, color: it.categoryColor });
      yy += 3.9;
      if (b.loc) {
        text(b.loc, X0, yy, { size: 8.5, color: it.mapsUrl ? C.link : C.muted, link: it.mapsUrl });
        if (it.mapsUrl) text('open in maps', X0 + CW, yy, { size: 7.5, color: C.link, align: 'right', link: it.mapsUrl });
        yy += 4.8;
      }
      if (it.price) { text(`Cost  ${it.price}`, X0, yy, { size: 8.5, bold: true, color: C.ink }); yy += 4.8; }
      if (b.descL.length) { b.descL.forEach((l) => { text(l, X0, yy, { size: 9, color: C.body }); yy += 4.1; }); yy += 1; }
      if (b.tipL.length) {
        const th = b.tipL.length * 3.9 + 4.5;
        yy += 1;
        rect(X0, yy - 2.8, CW, th, C.amberTint, 2);
        rect(X0, yy - 2.8, 1.2, th, C.amber);
        text('TIP', X0 + 4, yy + 0.4, { size: 6.5, bold: true, color: C.amberInk });
        b.tipL.forEach((l, j) => text(l, X0 + 4, yy + 4.2 + j * 3.9, { size: 8.5, color: C.amberInk }));
        yy += th + 1;
      }
      y = Math.max(yy, top + b.h) + 1;
    });
  });

  // ---- running header and footer on every page (second pass: the page count is known now) ----------------------
  const pages: number = pdf.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p);
    if (p > 1) {
      if (assets.logo) { try { pdf.addImage(assets.logo, 'PNG', M, 8, 7, 7); } catch { /* ignore */ } }
      text('PlanTravel', M + 9, 13, { size: 9, bold: true, color: C.teal });
      text(model.title, 210 - M, 13, { size: 8.5, color: C.muted, align: 'right' });
      pdf.setDrawColor(C.line);
      pdf.setLineWidth(0.25);
      pdf.line(M, 17, 210 - M, 17);
    }
    pdf.setDrawColor(C.line);
    pdf.setLineWidth(0.25);
    pdf.line(M, 285, 210 - M, 285);
    const left = model.url ? `Planned with PlanTravel · ${model.url.replace(/^https?:\/\//, '')}` : 'Planned with PlanTravel';
    text(left, M, 290, { size: 7.5, color: C.muted, link: model.url });
    text(`Prepared ${model.generated}  ·  Page ${p} of ${pages}`, 210 - M, 290, { size: 7.5, color: C.muted, align: 'right' });
  }
  return pdf;
}
