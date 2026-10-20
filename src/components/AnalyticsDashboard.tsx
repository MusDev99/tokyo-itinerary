import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { DayItinerary } from '../types/itinerary';
import { CATEGORIES, detectCategory, fetchLiveRates, type CategoryInfo } from '../utils/analytics';
import { buildHubCurrencies, currencyName, currencySymbol, formatMoney } from '../utils/currencyInfo';
import { useThemeColors } from './useThemeColors';
import CurrencyExchangeGraph from './CurrencyExchangeGraph';
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  BarController,
  DoughnutController,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js';
import { Doughnut, Chart } from 'react-chartjs-2';

ChartJS.register(
  ArcElement,
  BarElement,
  BarController,
  DoughnutController,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
);

interface Props {
  dataSources: { [country: string]: DayItinerary[] };
  /** Currencies of the countries that have an itinerary (MYR and USD are always added) */
  currencies?: string[];
}

interface Item {
  id: string;
  country: string;
  day: number;
  dayKey: string;
  title: string;
  description: string;
  note?: string;
  amount: number;
  currency: string;
  category: CategoryInfo;
  converted: number;
}

type Tab = 'overview' | 'currency' | 'expenses';
const PAGE_SIZES = [10, 25, 50] as const;

const slugLabel = (s: string) => s.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

export const AnalyticsDashboard: React.FC<Props> = ({ dataSources, currencies = [] }) => {
  const colors = useThemeColors();
  const hub = useMemo(() => buildHubCurrencies(currencies), [currencies.join('|')]);

  const [tab, setTab] = useState<Tab>('overview');
  const [base, setBase] = useState('MYR');
  const [rates, setRates] = useState<Record<string, number>>({});
  const [rateStatus, setRateStatus] = useState<'loading' | 'live' | 'fallback'>('loading');

  // Converter + chart target (defaults to the first trip currency that isn't the base)
  const firstTarget = hub.find((c) => c !== base) || 'USD';
  const [amount, setAmount] = useState(100);
  const [from, setFrom] = useState('MYR');
  const [to, setTo] = useState(firstTarget);
  const [graphTarget, setGraphTarget] = useState(firstTarget);

  // Expenses: filters, sorting, pagination
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [sort, setSort] = useState<'trip' | 'cost'>('trip');
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState(1);
  const listTop = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    setRateStatus('loading');
    fetchLiveRates(base)
      .then((r) => alive && (setRates(r), setRateStatus('live')))
      .catch(() => alive && setRateStatus('fallback'));
    return () => {
      alive = false;
    };
  }, [base]);

  // Keep converter/graph selections valid when the base or hub changes
  useEffect(() => {
    if (graphTarget === base || !hub.includes(graphTarget)) setGraphTarget(hub.find((c) => c !== base) || 'USD');
    if (!hub.includes(from)) setFrom(base);
    if (!hub.includes(to)) setTo(hub.find((c) => c !== base) || 'USD');
  }, [base, hub.join('|')]);

  const toBase = (value: number, cur: string) => {
    if (value <= 0 || cur === base) return value;
    const r = rates[cur];
    return r && r > 0 ? value / r : value;
  };

  const multiCountry = Object.keys(dataSources).length > 1;

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    Object.entries(dataSources).forEach(([country, itinerary]) => {
      if (!Array.isArray(itinerary)) return;
      itinerary.forEach((d) =>
        d.items.forEach((it, i) => {
          const amountN = it.price?.amount || 0;
          const cur = it.price?.currency || 'USD';
          out.push({
            id: `${country}-d${d.day}-i${i}`,
            country,
            day: d.day,
            dayKey: `${country}|${d.day}`,
            title: it.title,
            description: it.description,
            note: it.note,
            amount: amountN,
            currency: cur,
            category: detectCategory(it),
            converted: toBase(amountN, cur),
          });
        })
      );
    });
    return out;
  }, [dataSources, base, rates]);

  const paid = useMemo(() => items.filter((i) => i.amount > 0), [items]);
  const total = useMemo(() => paid.reduce((a, i) => a + i.converted, 0), [paid]);
  const dayKeys = useMemo(() => Array.from(new Set(items.map((i) => i.dayKey))), [items]);
  const totalDays = Math.max(dayKeys.length, 1);

  const nativeTotals = useMemo(() => {
    const m = new Map<string, { total: number; count: number }>();
    paid.forEach((i) => {
      const p = m.get(i.currency) || { total: 0, count: 0 };
      m.set(i.currency, { total: p.total + i.amount, count: p.count + 1 });
    });
    return [...m.entries()].map(([currency, v]) => ({ currency, ...v }));
  }, [paid]);

  const categoryStats = useMemo(() => {
    const m = new Map<string, { cat: CategoryInfo; total: number; count: number }>();
    paid.forEach((i) => {
      const p = m.get(i.category.key) || { cat: i.category, total: 0, count: 0 };
      m.set(i.category.key, { ...p, total: p.total + i.converted, count: p.count + 1 });
    });
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [paid]);

  // Per-day totals split by category (feeds the stacked chart + peak day)
  const daily = useMemo(() => {
    const m = new Map<string, { label: string; total: number; byCat: Record<string, number>; order: number }>();
    let order = 0;
    items.forEach((i) => {
      let d = m.get(i.dayKey);
      if (!d) {
        const prefix = multiCountry ? `${slugLabel(i.country).slice(0, 3).toUpperCase()} ` : '';
        d = { label: `${prefix}D${i.day}`, total: 0, byCat: {}, order: order++ };
        m.set(i.dayKey, d);
      }
      d.total += i.converted;
      d.byCat[i.category.key] = (d.byCat[i.category.key] || 0) + i.converted;
    });
    return [...m.values()].sort((a, b) => a.order - b.order);
  }, [items, multiCountry]);

  const peakDay = useMemo(() => [...daily].sort((a, b) => b.total - a.total)[0], [daily]);
  const topItems = useMemo(() => [...paid].sort((a, b) => b.converted - a.converted).slice(0, 6), [paid]);
  const avgPerDay = total / totalDays;

  const money = (v: number, c = base) => formatMoney(v, c);
  const tick = { color: colors.text + 'b3', font: { size: 11 } };
  const grid = { color: colors.text + '1a' };

  // ---- Charts -----------------------------------------------------------
  const doughnutData = {
    labels: categoryStats.map((c) => `${c.cat.emoji} ${c.cat.label}`),
    datasets: [
      {
        data: categoryStats.map((c) => Math.round(c.total)),
        backgroundColor: categoryStats.map((c) => c.cat.color),
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.6)',
        hoverOffset: 6,
      },
    ],
  };
  // Total in the middle of the doughnut (closure over the current total/colors)
  const centerPlugin = {
    id: 'centerText',
    afterDraw(chart: any) {
      const { ctx, chartArea } = chart;
      if (!chartArea) return;
      const cx = (chartArea.left + chartArea.right) / 2;
      const cy = (chartArea.top + chartArea.bottom) / 2;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = colors.text;
      ctx.font = '700 15px Inter, sans-serif';
      ctx.fillText(money(total), cx, cy - 8);
      ctx.fillStyle = colors.text + '99';
      ctx.font = '500 11px Inter, sans-serif';
      ctx.fillText('total spend', cx, cy + 10);
      ctx.restore();
    },
  };

  const stackedData: any = {
    labels: daily.map((d) => d.label),
    datasets: [
      ...categoryStats.map((c) => ({
        type: 'bar' as const,
        label: c.cat.label,
        data: daily.map((d) => Math.round(d.byCat[c.cat.key] || 0)),
        backgroundColor: c.cat.color,
        stack: 'spend',
        borderRadius: 3,
      })),
      {
        type: 'line' as const,
        label: `Average / day`,
        data: daily.map(() => Math.round(avgPerDay)),
        borderColor: colors.text,
        borderDash: [6, 5],
        borderWidth: 1.5,
        pointRadius: 0,
        fill: false,
      },
    ],
  };

  const topData = {
    labels: topItems.map((i) => (i.title.length > 26 ? `${i.title.slice(0, 25)}…` : i.title)),
    datasets: [
      {
        data: topItems.map((i) => Math.round(i.converted)),
        backgroundColor: topItems.map((i) => i.category.color),
        borderRadius: 6,
      },
    ],
  };

  // ---- Converter -------------------------------------------------------
  const converted = useMemo(() => {
    if (!amount || amount <= 0) return 0;
    if (from === to) return amount;
    const inBase = from === base ? amount : amount / (rates[from] || 1);
    return to === base ? inBase : inBase * (rates[to] || 1);
  }, [amount, from, to, base, rates]);

  // ---- Expenses: filter + sort + paginate ------------------------------
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = items.filter(
      (i) =>
        (!q || i.title.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q) || i.note?.toLowerCase().includes(q)) &&
        (catFilter === 'all' || i.category.key === catFilter) &&
        (countryFilter === 'all' || i.country === countryFilter)
    );
    return sort === 'cost' ? [...list].sort((a, b) => b.converted - a.converted) : list;
  }, [items, query, catFilter, countryFilter, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);
  const filteredTotal = filtered.reduce((a, i) => a + i.converted, 0);

  // Any filter/size change returns to page 1
  useEffect(() => setPage(1), [query, catFilter, countryFilter, sort, pageSize]);

  const goTo = (p: number) => {
    setPage(Math.min(Math.max(1, p), pageCount));
    listTop.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  // Compact page list: 1 … c-1 c c+1 … n
  const pageNumbers = useMemo(() => {
    const nums = new Set([1, pageCount, current - 1, current, current + 1]);
    const sorted = [...nums].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);
    const out: Array<number | '…'> = [];
    sorted.forEach((n, i) => {
      if (i > 0 && n - sorted[i - 1] > 1) out.push('…');
      out.push(n);
    });
    return out;
  }, [pageCount, current]);

  const card = 'rounded-2xl bg-white/40 border border-primary/20 p-4 sm:p-5';
  const field = 'bg-white/70 text-text text-sm rounded-lg px-3 py-2 border border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/40';

  return (
    <div className="w-full flex flex-col gap-4 sm:gap-5">
      {/* Header: title, live status, home currency */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-text">Spending & currency</h2>
          <p className="text-xs text-text/60 flex items-center gap-1.5 mt-0.5">
            <span className={`inline-block w-2 h-2 rounded-full ${rateStatus === 'live' ? 'bg-emerald-500' : 'bg-amber-400'}`} />
            {rateStatus === 'live' ? 'Live exchange rates' : rateStatus === 'loading' ? 'Loading rates…' : 'Offline rates (approximate)'}
          </p>
        </div>
        <label className="flex items-center justify-between sm:justify-start gap-2 text-xs font-semibold text-text/70">
          Home currency
          <select value={base} onChange={(e) => setBase(e.currentTarget.value)} className={field} aria-label="Home currency">
            {hub.map((c) => (
              <option key={c} value={c}>{c} ({currencySymbol(c)})</option>
            ))}
          </select>
        </label>
      </div>

      {/* Three tabs (Hick's Law: fewer choices) */}
      <div role="tablist" className="grid grid-cols-3 gap-1.5 p-1.5 rounded-xl bg-white/40 border border-primary/20">
        {([
          ['overview', '📊', 'Overview'],
          ['currency', '💱', 'Currency'],
          ['expenses', '📋', 'Expenses'],
        ] as const).map(([key, icon, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            type="button"
            onClick={() => setTab(key)}
            className={`touch-target flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors ${
              tab === key ? 'bg-primary text-white shadow-sm' : 'text-text/70 hover:bg-primary/10'
            }`}
          >
            <span aria-hidden="true">{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {/* ---------------- OVERVIEW ---------------- */}
      {tab === 'overview' && (
        <div className="flex flex-col gap-4 sm:gap-5">
          <div className={`${card} bg-gradient-to-br from-primary/15 to-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-text/60">Total estimated spend</div>
              <div className="text-3xl sm:text-4xl font-extrabold text-text break-words">{money(total)}</div>
              <div className="text-xs text-text/60 mt-1">
                ≈ {money(avgPerDay)} per day · {paid.length} paid of {items.length} activities
              </div>
            </div>
            <div className="flex flex-wrap sm:flex-col gap-1.5 sm:items-end">
              {nativeTotals.map((n) => (
                <span key={n.currency} className="px-2.5 py-1 rounded-lg bg-white/50 border border-primary/20 text-xs text-text/80">
                  <strong className="text-primary">{n.currency}</strong> {formatMoney(n.total, n.currency)}
                </span>
              ))}
            </div>
          </div>

          {paid.length === 0 ? (
            <div className={`${card} text-center text-sm text-text/60`}>No costs recorded yet. Add amounts to your activities to see charts.</div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
                <section className={card} aria-label="Spending by category">
                  <h3 className="text-sm font-extrabold text-text">Where the money goes</h3>
                  <p className="text-xs text-text/60 mb-3">Share of spend by category</p>
                  <div className="relative h-64 w-full">
                    <Doughnut
                      data={doughnutData}
                      plugins={[centerPlugin]}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '62%',
                        plugins: {
                          legend: { display: false },
                          tooltip: { callbacks: { label: (c: any) => ` ${c.label}: ${money(c.raw)}` } },
                        },
                      }}
                    />
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {categoryStats.map((c) => (
                      <li key={c.cat.key} className="flex items-center justify-between gap-3 text-xs">
                        <span className="flex items-center gap-2 text-text/80 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.cat.color }} />
                          <span className="truncate">{c.cat.emoji} {c.cat.label}</span>
                        </span>
                        <span className="font-semibold text-text whitespace-nowrap">
                          {money(c.total)} <span className="text-text/50">({total > 0 ? Math.round((c.total / total) * 100) : 0}%)</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className={card} aria-label="Top expenses">
                  <h3 className="text-sm font-extrabold text-text">Biggest expenses</h3>
                  <p className="text-xs text-text/60 mb-3">Top {topItems.length} activities in {base}</p>
                  <div className="relative" style={{ height: `${Math.max(200, topItems.length * 42)}px` }}>
                    <Chart
                      type="bar"
                      data={topData as any}
                      options={{
                        indexAxis: 'y',
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { display: false },
                          tooltip: { callbacks: { label: (c: any) => ` ${money(c.raw)}` } },
                        },
                        scales: {
                          x: { ticks: tick, grid },
                          y: { ticks: { ...tick, font: { size: 11 } }, grid: { display: false } },
                        },
                      } as any}
                    />
                  </div>
                </section>
              </div>

              <section className={card} aria-label="Daily spending">
                <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-text">Daily spending</h3>
                    <p className="text-xs text-text/60">Each bar is one day, split by category. Dashed line = daily average.</p>
                  </div>
                  {peakDay && (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-primary/10 text-primary">
                      Peak: {peakDay.label} · {money(peakDay.total)}
                    </span>
                  )}
                </div>
                <div className="relative h-64 sm:h-72 w-full">
                  <Chart
                    type="bar"
                    data={stackedData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      interaction: { mode: 'index', intersect: false },
                      plugins: {
                        legend: { position: 'bottom', labels: { color: colors.text + 'cc', boxWidth: 10, font: { size: 11 } } },
                        tooltip: { callbacks: { label: (c: any) => ` ${c.dataset.label}: ${money(c.raw)}` } },
                      },
                      scales: {
                        x: { stacked: true, ticks: tick, grid: { display: false } },
                        y: { stacked: true, ticks: tick, grid },
                      },
                    } as any}
                  />
                </div>
              </section>
            </>
          )}
        </div>
      )}

      {/* ---------------- CURRENCY ---------------- */}
      {tab === 'currency' && (
        <div className="flex flex-col gap-4 sm:gap-5">
          <section aria-label="Exchange rates">
            <h3 className="text-sm font-extrabold text-text mb-2">1 {base} equals</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {hub.filter((c) => c !== base).map((code) => {
                const rate = rates[code];
                const active = graphTarget === code;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => { setGraphTarget(code); setTo(code); }}
                    className={`text-left p-3 rounded-xl border transition-colors ${
                      active ? 'bg-primary/20 border-primary ring-2 ring-primary/30' : 'bg-white/45 border-primary/20 hover:bg-primary/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-sm text-text">{code}</span>
                      <span className="text-[11px] text-primary font-bold">{active ? 'Charted' : 'Chart ↗'}</span>
                    </div>
                    <div className="text-lg font-extrabold text-text mt-0.5">{rate ? rate.toLocaleString('en-US', { maximumFractionDigits: rate < 1 ? 4 : 2 }) : '—'}</div>
                    <div className="text-[11px] text-text/60 truncate">{currencyName(code)}</div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className={card} aria-label="Currency converter">
            <h3 className="text-sm font-extrabold text-text mb-3">Converter</h3>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-text/60 font-medium">Amount</label>
                <div className="flex rounded-xl overflow-hidden border border-primary/30 bg-white/70">
                  <input type="number" min="0" value={amount} onChange={(e) => setAmount(parseFloat(e.currentTarget.value) || 0)}
                    className="w-full min-w-0 px-3 py-2 bg-transparent text-text font-bold focus:outline-none" />
                  <select value={from} onChange={(e) => setFrom(e.currentTarget.value)} className="bg-white/60 text-text font-semibold px-2.5 border-l border-primary/30 focus:outline-none" aria-label="From currency">
                    {hub.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <button type="button" onClick={() => { setFrom(to); setTo(from); }}
                className="touch-target mx-auto w-11 h-11 rounded-full bg-primary/15 border border-primary/30 text-primary font-bold" aria-label="Swap currencies">⇄</button>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-text/60 font-medium">Converted</label>
                <div className="flex rounded-xl overflow-hidden border border-primary/30 bg-white/70">
                  <div className="w-full min-w-0 px-3 py-2 text-text font-extrabold truncate">{formatMoney(converted, to)}</div>
                  <select value={to} onChange={(e) => { setTo(e.currentTarget.value); if (e.currentTarget.value !== base) setGraphTarget(e.currentTarget.value); }}
                    className="bg-white/60 text-text font-semibold px-2.5 border-l border-primary/30 focus:outline-none" aria-label="To currency">
                    {hub.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 pt-3">
              {[10, 100, 500, 1000, 5000].map((a) => (
                <button key={a} type="button" onClick={() => setAmount(a)}
                  className="px-2.5 py-1 text-xs rounded-lg bg-white/50 border border-primary/20 hover:bg-primary/10 text-text/80">{a.toLocaleString()}</button>
              ))}
            </div>
          </section>

          <section className={card} aria-label="Exchange rate history">
            <h3 className="text-sm font-extrabold text-text">Rate history · {base} → {graphTarget}</h3>
            <p className="text-xs text-text/60 mb-3">See whether now is a good time to exchange.</p>
            <CurrencyExchangeGraph
              baseCurrency={base}
              targetCurrency={graphTarget}
              availableTargets={hub.filter((c) => c !== base)}
              onTargetChange={(t) => { setGraphTarget(t); setTo(t); }}
            />
          </section>
        </div>
      )}

      {/* ---------------- EXPENSES (paginated) ---------------- */}
      {tab === 'expenses' && (
        <div className="flex flex-col gap-3" ref={listTop}>
          <div className="flex flex-col lg:flex-row gap-2.5 p-3 rounded-xl bg-white/40 border border-primary/20">
            <input type="search" value={query} onChange={(e) => setQuery(e.currentTarget.value)} placeholder="Search activities…"
              className={`${field} w-full lg:flex-1`} aria-label="Search expenses" />
            <div className="grid grid-cols-2 sm:flex gap-2">
              <select value={catFilter} onChange={(e) => setCatFilter(e.currentTarget.value)} className={field} aria-label="Category">
                <option value="all">All categories</option>
                {Object.values(CATEGORIES).map((c) => <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>)}
              </select>
              {multiCountry && (
                <select value={countryFilter} onChange={(e) => setCountryFilter(e.currentTarget.value)} className={field} aria-label="Country">
                  <option value="all">All countries</option>
                  {Object.keys(dataSources).map((c) => <option key={c} value={c}>{slugLabel(c)}</option>)}
                </select>
              )}
              <select value={sort} onChange={(e) => setSort(e.currentTarget.value as any)} className={field} aria-label="Sort">
                <option value="trip">Trip order</option>
                <option value="cost">Highest cost</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text/60 px-1">
            <span>
              {filtered.length === 0 ? 'No items' : `Showing ${start + 1}–${Math.min(start + pageSize, filtered.length)} of ${filtered.length}`}
            </span>
            <span>Filtered total: <strong className="text-text">{money(filteredTotal)}</strong></span>
          </div>

          {pageItems.length === 0 ? (
            <div className="p-6 text-center text-sm text-text/60 rounded-xl border border-primary/20 bg-white/30">No activities match your filters.</div>
          ) : (
            <ul className="grid gap-2">
              {pageItems.map((i) => (
                <li key={i.id} className="rounded-xl border border-primary/20 bg-white/45 p-3 sm:px-4 sm:py-3 flex items-start sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-bold">
                        {multiCountry ? `${slugLabel(i.country)} · ` : ''}Day {i.day}
                      </span>
                      <span className="text-[11px] font-semibold" style={{ color: i.category.color }}>{i.category.emoji} {i.category.label}</span>
                    </div>
                    <div className="font-semibold text-sm text-text truncate">{i.title}</div>
                    {i.description && <div className="text-xs text-text/60 line-clamp-1">{i.description}</div>}
                  </div>
                  <div className="text-right shrink-0">
                    {i.amount > 0 ? (
                      <>
                        <div className="text-sm font-extrabold text-text">{money(i.converted)}</div>
                        {i.currency !== base && <div className="text-[11px] text-text/55">{formatMoney(i.amount, i.currency)}</div>}
                      </>
                    ) : (
                      <span className="text-xs font-bold text-emerald-600">Free</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Pagination (Fitts's Law: 44px targets; Jakob's Law: familiar prev/numbers/next) */}
          {filtered.length > 0 && (
            <nav aria-label="Expenses pages" className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
              <label className="flex items-center gap-2 text-xs text-text/60">
                Rows per page
                <select value={pageSize} onChange={(e) => setPageSize(Number(e.currentTarget.value))} className={field}>
                  {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => goTo(current - 1)} disabled={current === 1}
                  className="touch-target px-3 rounded-lg border border-primary/25 bg-white/50 text-sm font-bold text-text disabled:opacity-40" aria-label="Previous page">‹</button>
                {pageNumbers.map((n, idx) =>
                  n === '…' ? (
                    <span key={`e${idx}`} className="px-1.5 text-text/50" aria-hidden="true">…</span>
                  ) : (
                    <button key={n} type="button" onClick={() => goTo(n)} aria-current={n === current ? 'page' : undefined}
                      className={`touch-target min-w-[44px] px-2 rounded-lg border text-sm font-bold ${
                        n === current ? 'bg-primary text-white border-primary' : 'bg-white/50 border-primary/25 text-text hover:bg-primary/10'
                      }`}>{n}</button>
                  )
                )}
                <button type="button" onClick={() => goTo(current + 1)} disabled={current === pageCount}
                  className="touch-target px-3 rounded-lg border border-primary/25 bg-white/50 text-sm font-bold text-text disabled:opacity-40" aria-label="Next page">›</button>
              </div>
            </nav>
          )}
        </div>
      )}
    </div>
  );
};

export default AnalyticsDashboard;
