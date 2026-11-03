import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { DayItinerary } from '../types/itinerary';
import { CATEGORIES, detectCategory, fetchLiveRates, type CategoryInfo } from '../utils/analytics';
import { buildHubCurrencies, currencySymbol, formatMoney } from '../utils/currencyInfo';
import CurrencyExchangeGraph from './CurrencyExchangeGraph';
import SpendDonut from './SpendDonut';
import SpendHistory from './SpendHistory';
import { groupSpendByDay, type SpendLine } from '../utils/spendHistory';

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
  date: string;
  time: string;
  state?: string;
  amount: number;
  currency: string;
  category: CategoryInfo;
  converted: number;
}

type Tab = 'overview' | 'currency' | 'expenses';
const PAGE_SIZES = [10, 25, 50] as const;

const slugLabel = (s: string) => s.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

export const AnalyticsDashboard: React.FC<Props> = ({ dataSources, currencies = [] }) => {
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
            date: d.date,
            time: it.time,
            state: d.state,
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

  // Daily spending history: paid lines grouped by trip day (the list under the donut)
  const dayGroups = useMemo(
    () =>
      groupSpendByDay(
        items.map<SpendLine>((i) => ({
          id: i.id, dayKey: i.dayKey, day: i.day, country: i.country, state: i.state, date: i.date, time: i.time,
          title: i.title, description: i.description, note: i.note, converted: i.converted, currency: i.currency, amount: i.amount,
          categoryKey: i.category.key,
        }))
      ),
    [items]
  );
  const categoryLook = useMemo(() => Object.fromEntries(Object.values(CATEGORIES).map((c) => [c.key, { emoji: c.emoji, color: c.color }])), []);
  const avgPerDay = total / totalDays;

  const money = (v: number, c = base) => formatMoney(v, c);

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
              <section className={card} aria-label="Spending by category">
                <h3 className="text-sm font-extrabold text-text">Where the money goes</h3>
                <p className="text-xs text-text/60 mb-4">Tap a slice or a row to look closer</p>
                <SpendDonut
                  slices={categoryStats.map((c) => ({ key: c.cat.key, label: c.cat.label, emoji: c.cat.emoji, color: c.cat.color, total: c.total, count: c.count }))}
                  total={total}
                  money={money}
                  title={`Spend by category, total ${money(total)}`}
                />
              </section>

              <section aria-label="Daily spending">
                <h3 className="text-sm font-extrabold text-text">Daily spending</h3>
                <p className="text-xs text-text/60 mb-3">Every payment, grouped by day</p>
                <SpendHistory groups={dayGroups} categories={categoryLook} money={money} countryLabel={multiCountry ? slugLabel : undefined} />
              </section>
            </>
          )}
        </div>
      )}

      {/* ---------------- CURRENCY ---------------- */}
      {tab === 'currency' && (
        <div className="flex flex-col gap-4 sm:gap-5">
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
