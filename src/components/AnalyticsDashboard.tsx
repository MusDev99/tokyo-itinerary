import React, { useState, useEffect, useMemo } from 'react';
import type { DayItinerary } from '../types/itinerary';
import {
  CATEGORIES,
  POPULAR_CURRENCIES,
  detectCategory,
  fetchLiveRates,
  type CategoryInfo,
} from '../utils/analytics';
import CurrencyExchangeGraph from './CurrencyExchangeGraph';
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

interface AnalyticsDashboardProps {
  dataSources: { [country: string]: DayItinerary[] };
}

interface FlattenedExpenseItem {
  id: string;
  country: string;
  day: number;
  dateStr: string;
  title: string;
  description: string;
  note?: string;
  amount: number;
  currency: string;
  category: CategoryInfo;
  convertedAmount: number;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ dataSources }) => {
  // Navigation & user preferences
  const [activeTab, setActiveTab] = useState<'overview' | 'charts' | 'currency' | 'expenses'>('overview');
  const [baseCurrency, setBaseCurrency] = useState<string>('MYR');
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
  const [rateStatus, setRateStatus] = useState<'loading' | 'success' | 'fallback'>('loading');

  // Quick Currency Converter state
  const [converterAmount, setConverterAmount] = useState<number>(100);
  const [converterFrom, setConverterFrom] = useState<string>('MYR');
  const [converterTo, setConverterTo] = useState<string>('JPY');

  // Graph state in Currency Hub
  const [graphTarget, setGraphTarget] = useState<string>('JPY');

  // Expenses filtering
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>('all');

  // Fetch live exchange rates whenever base currency changes
  useEffect(() => {
    let isMounted = true;
    setRateStatus('loading');

    fetchLiveRates(baseCurrency)
      .then((rates) => {
        if (!isMounted) return;
        setExchangeRates(rates);
        setRateStatus('success');
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('Failed to fetch live rates, using fallback:', err);
        setRateStatus('fallback');
      });

    return () => {
      isMounted = false;
    };
  }, [baseCurrency]);

  // Convert amount from one currency to base currency
  const toBase = useMemo(() => {
    return (amount: number, fromCurrency: string): number => {
      if (amount <= 0) return 0;
      if (fromCurrency === baseCurrency) return amount;
      const rate = exchangeRates[fromCurrency];
      if (rate && rate > 0) {
        return amount / rate;
      }
      return amount; // default 1:1 if rate unknown
    };
  }, [baseCurrency, exchangeRates]);

  // Flatten and process all expense items across all itineraries
  const processedItems = useMemo<FlattenedExpenseItem[]>(() => {
    const list: FlattenedExpenseItem[] = [];

    Object.entries(dataSources).forEach(([country, itinerary]) => {
      if (!Array.isArray(itinerary)) return;

      itinerary.forEach((dayObj) => {
        const dayNumber = dayObj.day;
        const dateStr = dayObj.date || `Day ${dayNumber}`;

        dayObj.items.forEach((item, idx) => {
          const amount = item.price?.amount || 0;
          const currency = item.price?.currency || 'JPY';
          const category = detectCategory(item);
          const converted = toBase(amount, currency);

          list.push({
            id: `${country}-d${dayNumber}-i${idx}`,
            country,
            day: dayNumber,
            dateStr,
            title: item.title,
            description: item.description,
            note: item.note,
            amount,
            currency,
            category,
            convertedAmount: converted,
          });
        });
      });
    });

    return list;
  }, [dataSources, toBase]);

  // Non-zero expense items for financial analytics
  const paidItems = useMemo(() => {
    return processedItems.filter((item) => item.amount > 0);
  }, [processedItems]);

  // Currency summaries (totals grouped by native currency)
  const currencySummaries = useMemo(() => {
    const map = new Map<string, { total: number; count: number; inBase: number }>();

    paidItems.forEach((item) => {
      const prev = map.get(item.currency) || { total: 0, count: 0, inBase: 0 };
      map.set(item.currency, {
        total: prev.total + item.amount,
        count: prev.count + 1,
        inBase: prev.inBase + item.convertedAmount,
      });
    });

    return Array.from(map.entries()).map(([currency, data]) => ({
      currency,
      ...data,
      avg: data.total / data.count,
    }));
  }, [paidItems]);

  // Total trip cost in active base currency
  const totalCostInBase = useMemo(() => {
    return paidItems.reduce((acc, item) => acc + item.convertedAmount, 0);
  }, [paidItems]);

  // Total distinct travel days
  const totalDays = useMemo(() => {
    const set = new Set<string>();
    processedItems.forEach((item) => set.add(`${item.country}-${item.day}`));
    return Math.max(set.size, 1);
  }, [processedItems]);

  // Top / peak metrics
  const topExpenseItem = useMemo(() => {
    if (paidItems.length === 0) return null;
    return [...paidItems].sort((a, b) => b.convertedAmount - a.convertedAmount)[0];
  }, [paidItems]);

  // Group by Day for daily timeline chart & peak day
  const dailySpending = useMemo(() => {
    const map = new Map<string, { dayLabel: string; dayNum: number; totalBase: number; count: number }>();

    processedItems.forEach((item) => {
      const key = `Day ${item.day}`;
      const prev = map.get(key) || { dayLabel: key, dayNum: item.day, totalBase: 0, count: 0 };
      map.set(key, {
        ...prev,
        totalBase: prev.totalBase + item.convertedAmount,
        count: prev.count + 1,
      });
    });

    const list = Array.from(map.values()).sort((a, b) => a.dayNum - b.dayNum);
    return list;
  }, [processedItems]);

  const peakDay = useMemo(() => {
    if (dailySpending.length === 0) return null;
    return [...dailySpending].sort((a, b) => b.totalBase - a.totalBase)[0];
  }, [dailySpending]);

  // Category breakdown for doughnut chart
  const categoryStats = useMemo(() => {
    const map = new Map<string, { category: CategoryInfo; totalBase: number; count: number }>();

    paidItems.forEach((item) => {
      const catKey = item.category.key;
      const prev = map.get(catKey) || { category: item.category, totalBase: 0, count: 0 };
      map.set(catKey, {
        ...prev,
        totalBase: prev.totalBase + item.convertedAmount,
        count: prev.count + 1,
      });
    });

    return Array.from(map.values()).sort((a, b) => b.totalBase - a.totalBase);
  }, [paidItems]);

  // Doughnut Chart Data for Categories
  const categoryChartData = useMemo(() => {
    return {
      labels: categoryStats.map((c) => `${c.category.emoji} ${c.category.label}`),
      datasets: [
        {
          data: categoryStats.map((c) => Math.round(c.totalBase)),
          backgroundColor: categoryStats.map((c) => c.category.color),
          borderWidth: 2,
          borderColor: 'rgba(255, 255, 255, 0.1)',
        },
      ],
    };
  }, [categoryStats]);

  // Daily Spending Bar Chart Data
  const dailyChartData = useMemo(() => {
    return {
      labels: dailySpending.map((d) => d.dayLabel),
      datasets: [
        {
          label: `Daily Spending (${baseCurrency})`,
          data: dailySpending.map((d) => Math.round(d.totalBase)),
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          hoverBackgroundColor: 'rgba(59, 130, 246, 1)',
          borderRadius: 6,
        },
      ],
    };
  }, [dailySpending, baseCurrency]);

  // Quick Currency Converter computation
  const convertedResult = useMemo(() => {
    if (!converterAmount || converterAmount <= 0) return 0;
    if (converterFrom === converterTo) return converterAmount;

    // Convert from -> base -> to
    let inBase = converterAmount;
    if (converterFrom !== baseCurrency) {
      const fromRate = exchangeRates[converterFrom] || 1;
      inBase = converterAmount / fromRate;
    }

    if (converterTo === baseCurrency) {
      return inBase;
    }

    const toRate = exchangeRates[converterTo] || 1;
    return inBase * toRate;
  }, [converterAmount, converterFrom, converterTo, baseCurrency, exchangeRates]);

  // Filtered detailed items
  const filteredItems = useMemo(() => {
    return processedItems.filter((item) => {
      const matchesSearch =
        searchQuery === '' ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.note && item.note.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCat =
        selectedCategoryFilter === 'all' || item.category.key === selectedCategoryFilter;

      const matchesDay =
        selectedDayFilter === 'all' || item.day.toString() === selectedDayFilter;

      return matchesSearch && matchesCat && matchesDay;
    });
  }, [processedItems, searchQuery, selectedCategoryFilter, selectedDayFilter]);

  // Format currency helper
  const formatAmount = (val: number, curr: string) => {
    const isZeroDecimal = ['JPY', 'KZT'].includes(curr);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: curr,
      minimumFractionDigits: isZeroDecimal ? 0 : 2,
      maximumFractionDigits: isZeroDecimal ? 0 : 2,
    }).format(val);
  };

  return (
    <div className="w-full flex flex-col gap-5 sm:gap-6">
      {/* Top Header Bar: Title, Live Status, Base Currency Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4 pb-4 border-b border-primary/20">
        <div className="flex items-center gap-3">
          <div className="p-2 sm:p-2.5 rounded-xl bg-primary/10 border border-primary/30 text-primary shrink-0">
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-2xl font-bold text-text truncate">Trip Analytics & Currency</h2>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-text/60">
              <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${rateStatus === 'success' ? 'bg-emerald-400 animate-pulse' : 'bg-yellow-400'}`}></span>
              <span className="truncate">{rateStatus === 'success' ? 'Live Public API Connected' : 'Rates Initializing...'}</span>
            </div>
          </div>
        </div>

        {/* Base Currency Switcher */}
        <div className="flex items-center justify-between sm:justify-start gap-2 bg-bg/50 px-3 py-2 rounded-xl border border-primary/20 w-full sm:w-auto">
          <label htmlFor="base-currency-select" className="text-xs text-text/70 font-medium whitespace-nowrap">
            Home Currency:
          </label>
          <select
            id="base-currency-select"
            value={baseCurrency}
            onChange={(e) => setBaseCurrency(e.currentTarget.value)}
            className="bg-bg text-text text-xs sm:text-sm font-semibold rounded-lg px-2.5 py-1.5 border border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
          >
            {POPULAR_CURRENCIES.map((curr) => (
              <option key={curr.code} value={curr.code}>
                {curr.flag} {curr.code} ({curr.symbol})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Segmented Navigation Tabs (2x2 grid on mobile, row on sm+) */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5 sm:gap-2 p-1.5 rounded-xl bg-bg/40 border border-primary/20">
        {[
          { key: 'overview', label: 'Overview', icon: '📊' },
          { key: 'charts', label: 'Charts & Insights', icon: '📈' },
          { key: 'currency', label: 'Currency Hub', icon: '💱' },
          { key: 'expenses', label: 'Expenses', icon: '📋' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as any)}
            className={`touch-target flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === tab.key
                ? 'bg-primary text-white shadow-md'
                : 'text-text/70 hover:text-text hover:bg-primary/10'
            }`}
          >
            <span>{tab.icon}</span>
            <span className="truncate">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-5 sm:gap-6">
          {/* Hero Banner with Total Converted Cost */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-secondary/10 to-bg/50 p-4 sm:p-6 border border-primary/30 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="min-w-0">
                <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-text/70">
                  Total Trip Expenditure (Converted)
                </span>
                <div className="text-2xl sm:text-4xl font-extrabold text-text mt-1 break-words">
                  {formatAmount(totalCostInBase, baseCurrency)}
                </div>
                <div className="text-xs text-text/60 mt-1 flex flex-wrap gap-2">
                  <span>Based on live exchange rates to {baseCurrency}</span>
                </div>
              </div>

              {/* Native currency breakdown chips */}
              <div className="flex flex-wrap sm:flex-col items-start sm:items-end gap-1.5">
                {currencySummaries.map((s) => (
                  <div
                    key={s.currency}
                    className="px-2.5 sm:px-3 py-1 rounded-lg bg-bg/60 border border-primary/20 text-xs text-text/80 flex items-center gap-1.5 sm:gap-2"
                  >
                    <span className="font-bold text-primary">{s.currency}</span>
                    <span>{formatAmount(s.total, s.currency)}</span>
                    <span className="text-text/40">({s.count})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 4 Key Metric Cards (2x2 on mobile, 4 columns on desktop) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-3.5 sm:p-4 rounded-xl bg-bg/40 border border-primary/20 flex flex-col gap-1 min-w-0">
              <span className="text-[11px] sm:text-xs text-text/60 font-medium truncate">Daily Spend Avg</span>
              <span className="text-base sm:text-xl font-bold text-text truncate">
                {formatAmount(totalCostInBase / totalDays, baseCurrency)}
              </span>
              <span className="text-[10px] sm:text-[11px] text-text/50">Across {totalDays} days</span>
            </div>

            <div className="p-3.5 sm:p-4 rounded-xl bg-bg/40 border border-primary/20 flex flex-col gap-1 min-w-0">
              <span className="text-[11px] sm:text-xs text-text/60 font-medium truncate">Total Activities</span>
              <span className="text-base sm:text-xl font-bold text-text">{processedItems.length}</span>
              <span className="text-[10px] sm:text-[11px] text-text/50">
                Avg {(processedItems.length / totalDays).toFixed(1)} / day
              </span>
            </div>

            <div className="p-3.5 sm:p-4 rounded-xl bg-bg/40 border border-primary/20 flex flex-col gap-1 min-w-0">
              <span className="text-[11px] sm:text-xs text-text/60 font-medium truncate">Top Single Expense</span>
              {topExpenseItem ? (
                <>
                  <span className="text-xs sm:text-sm font-bold text-text truncate" title={topExpenseItem.title}>
                    {topExpenseItem.title}
                  </span>
                  <span className="text-[11px] sm:text-xs font-semibold text-primary truncate">
                    {formatAmount(topExpenseItem.convertedAmount, baseCurrency)}
                  </span>
                </>
              ) : (
                <span className="text-sm text-text/50">None</span>
              )}
            </div>

            <div className="p-3.5 sm:p-4 rounded-xl bg-bg/40 border border-primary/20 flex flex-col gap-1 min-w-0">
              <span className="text-[11px] sm:text-xs text-text/60 font-medium truncate">Peak Spending Day</span>
              {peakDay ? (
                <>
                  <span className="text-base sm:text-xl font-bold text-text">{peakDay.dayLabel}</span>
                  <span className="text-[11px] sm:text-xs text-text/60 truncate">
                    {formatAmount(peakDay.totalBase, baseCurrency)} ({peakDay.count})
                  </span>
                </>
              ) : (
                <span className="text-sm text-text/50">None</span>
              )}
            </div>
          </div>

          {/* Quick Category Summary Grid */}
          <div className="rounded-xl bg-bg/30 p-4 sm:p-5 border border-primary/20">
            <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-text/70 mb-3">
              Spending by Category
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 sm:gap-3">
              {categoryStats.map((stat) => (
                <div
                  key={stat.category.key}
                  className={`p-3 rounded-xl border flex flex-col gap-1 min-w-0 ${stat.category.bgClass}`}
                >
                  <span className="text-lg">{stat.category.emoji}</span>
                  <span className="text-xs font-semibold truncate">{stat.category.label}</span>
                  <span className="text-xs sm:text-sm font-bold text-text mt-0.5 truncate">
                    {formatAmount(stat.totalBase, baseCurrency)}
                  </span>
                  <span className="text-[10px] text-text/60">
                    {totalCostInBase > 0 ? ((stat.totalBase / totalCostInBase) * 100).toFixed(0) : 0}% of budget
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CHARTS & INSIGHTS */}
      {activeTab === 'charts' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Category Distribution (Doughnut Chart) */}
          <div className="p-5 rounded-2xl bg-bg/30 border border-primary/20 flex flex-col gap-4">
            <div>
              <h3 className="text-base font-bold text-text flex items-center gap-2">
                <span>🥧</span> Category Expense Distribution
              </h3>
              <p className="text-xs text-text/60">Share of total expenditure by activity category</p>
            </div>

            <div className="relative h-64 sm:h-72 w-full flex items-center justify-center">
              {categoryStats.length > 0 ? (
                <Doughnut
                  data={categoryChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom',
                        labels: {
                          color: 'rgba(156, 163, 175, 0.9)',
                          font: { size: 11 },
                          padding: 12,
                        },
                      },
                      tooltip: {
                        callbacks: {
                          label: (ctx: any) => ` ${ctx.label}: ${formatAmount(ctx.raw, baseCurrency)}`,
                        },
                      },
                    },
                  }}
                />
              ) : (
                <div className="text-sm text-text/50">No expenses recorded yet.</div>
              )}
            </div>

            {/* List breakdown */}
            <div className="space-y-1.5 pt-2 border-t border-primary/10">
              {categoryStats.map((c) => (
                <div key={c.category.key} className="flex items-center justify-between text-xs py-1">
                  <span className="flex items-center gap-1.5 text-text/80">
                    <span>{c.category.emoji}</span>
                    <span>{c.category.label}</span>
                  </span>
                  <span className="font-semibold text-text">
                    {formatAmount(c.totalBase, baseCurrency)}{' '}
                    <span className="text-text/50">
                      ({totalCostInBase > 0 ? ((c.totalBase / totalCostInBase) * 100).toFixed(1) : 0}%)
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Daily Spending Timeline (Bar Chart) */}
          <div className="p-5 rounded-2xl bg-bg/30 border border-primary/20 flex flex-col gap-4">
            <div>
              <h3 className="text-base font-bold text-text flex items-center gap-2">
                <span>📊</span> Daily Expenditure Timeline
              </h3>
              <p className="text-xs text-text/60">Day-by-day spending converted into {baseCurrency}</p>
            </div>

            <div className="relative h-64 sm:h-72 w-full flex items-center justify-center">
              {dailySpending.length > 0 ? (
                <Bar
                  data={dailyChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          label: (ctx: any) => ` Spending: ${formatAmount(ctx.raw, baseCurrency)}`,
                        },
                      },
                    },
                    scales: {
                      x: {
                        ticks: { color: 'rgba(156, 163, 175, 0.8)', font: { size: 11 } },
                        grid: { display: false },
                      },
                      y: {
                        ticks: { color: 'rgba(156, 163, 175, 0.8)', font: { size: 11 } },
                        grid: { color: 'rgba(156, 163, 175, 0.1)' },
                      },
                    },
                  }}
                />
              ) : (
                <div className="text-sm text-text/50">No daily spending data.</div>
              )}
            </div>

            {/* Quick insights callout */}
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs text-text/80 flex items-center justify-between">
              <span>Average Daily Expense:</span>
              <span className="font-bold text-text">{formatAmount(totalCostInBase / totalDays, baseCurrency)}</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CURRENCY HUB */}
      {activeTab === 'currency' && (
        <div className="flex flex-col gap-6">
          {/* Live Rate Destination Cards */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-text/70 mb-3">
              Destination Exchange Rates (1 {baseCurrency})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {['JPY', 'KZT', 'CNY', 'TRY', 'AUD'].map((destCode) => {
                const rate = exchangeRates[destCode];
                return (
                  <div
                    key={destCode}
                    onClick={() => {
                      setConverterTo(destCode);
                      setGraphTarget(destCode);
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      graphTarget === destCode
                        ? 'bg-primary/20 border-primary ring-2 ring-primary/40'
                        : 'bg-bg/40 border-primary/20 hover:bg-bg/70'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-text">{destCode}</span>
                      <span className="text-xs text-primary font-semibold">Track ↗</span>
                    </div>
                    <div className="text-lg font-extrabold text-text mt-1">
                      {rate ? rate.toFixed(destCode === 'JPY' || destCode === 'KZT' ? 2 : 4) : '—'}
                    </div>
                    <div className="text-[10px] text-text/60">
                      1 {baseCurrency} = {rate ? rate.toFixed(2) : '...'} {destCode}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Interactive Currency Converter */}
          <div className="p-4 sm:p-5 rounded-2xl bg-bg/30 border border-primary/20 flex flex-col gap-4">
            <h3 className="text-base font-bold text-text flex items-center gap-2">
              <span>🧮</span> Quick Currency Converter
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-5 items-center gap-2.5 sm:gap-3">
              {/* Amount & From */}
              <div className="md:col-span-2 flex flex-col gap-1">
                <label className="text-xs text-text/60 font-medium">Amount</label>
                <div className="flex rounded-xl overflow-hidden border border-primary/30 bg-bg">
                  <input
                    type="number"
                    min="1"
                    value={converterAmount}
                    onChange={(e) => setConverterAmount(parseFloat(e.currentTarget.value) || 0)}
                    className="w-full min-w-0 px-3 py-2 bg-transparent text-text font-bold focus:outline-none"
                    placeholder="Enter amount"
                  />
                  <select
                    value={converterFrom}
                    onChange={(e) => setConverterFrom(e.currentTarget.value)}
                    className="bg-bg/80 text-text font-semibold px-3 py-2 border-l border-primary/30 focus:outline-none cursor-pointer shrink-0"
                  >
                    {POPULAR_CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Swap Button */}
              <div className="flex justify-center md:col-span-1 py-1 md:pt-5">
                <button
                  type="button"
                  onClick={() => {
                    const temp = converterFrom;
                    setConverterFrom(converterTo);
                    setConverterTo(temp);
                  }}
                  className="p-2.5 rounded-full bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary transition-all cursor-pointer"
                  title="Swap currencies"
                >
                  ⇄
                </button>
              </div>

              {/* Converted To Result */}
              <div className="md:col-span-2 flex flex-col gap-1">
                <label className="text-xs text-text/60 font-medium">Converted To</label>
                <div className="flex rounded-xl overflow-hidden border border-primary/30 bg-bg">
                  <div className="w-full min-w-0 px-3 py-2 text-text font-extrabold text-base sm:text-lg flex items-center truncate">
                    {formatAmount(convertedResult, converterTo)}
                  </div>
                  <select
                    value={converterTo}
                    onChange={(e) => {
                      setConverterTo(e.currentTarget.value);
                      setGraphTarget(e.currentTarget.value);
                    }}
                    className="bg-bg/80 text-text font-semibold px-3 py-2 border-l border-primary/30 focus:outline-none cursor-pointer shrink-0"
                  >
                    {POPULAR_CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Preset quick buttons */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-xs text-text/50">Quick Amounts:</span>
              {[50, 100, 500, 1000, 5000, 10000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setConverterAmount(amt)}
                  className="px-2.5 py-1 text-xs rounded-lg bg-bg/50 border border-primary/20 hover:bg-primary/10 text-text/80 transition-all cursor-pointer"
                >
                  {amt.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Historical Trend Chart Component */}
          <div className="p-4 sm:p-5 rounded-2xl bg-bg/30 border border-primary/20 flex flex-col gap-4">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-text flex items-center gap-2">
                <span>📈</span> Historical Exchange Rate Trend ({baseCurrency} → {graphTarget})
              </h3>
              <p className="text-xs text-text/60">
                Track rate movements over 7, 14, or 30 days to time currency exchange
              </p>
            </div>

            <CurrencyExchangeGraph
              baseCurrency={baseCurrency}
              targetCurrency={graphTarget}
              availableTargets={['JPY', 'KZT', 'CNY', 'TRY', 'AUD', 'USD', 'EUR']}
              onTargetChange={(target) => {
                setGraphTarget(target);
                setConverterTo(target);
              }}
            />
          </div>
        </div>
      )}

      {/* TAB 4: DETAILED EXPENSES TABLE */}
      {activeTab === 'expenses' && (
        <div className="flex flex-col gap-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 p-3.5 sm:p-4 rounded-xl bg-bg/30 border border-primary/20">
            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.currentTarget.value)}
                placeholder="Search activity, description, notes..."
                className="w-full bg-bg text-text text-sm rounded-lg pl-9 pr-3 py-2 border border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <svg
                className="w-4 h-4 text-text/50 absolute left-3 top-2.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Dropdown Filters */}
            <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
              {/* Category Filter */}
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.currentTarget.value)}
                className="bg-bg text-text text-xs sm:text-sm rounded-lg px-2.5 sm:px-3 py-2 border border-primary/30 focus:outline-none cursor-pointer w-full sm:w-auto"
              >
                <option value="all">All Categories</option>
                {Object.values(CATEGORIES).map((cat) => (
                  <option key={cat.key} value={cat.key}>
                    {cat.emoji} {cat.label}
                  </option>
                ))}
              </select>

              {/* Day Filter */}
              <select
                value={selectedDayFilter}
                onChange={(e) => setSelectedDayFilter(e.currentTarget.value)}
                className="bg-bg text-text text-xs sm:text-sm rounded-lg px-2.5 sm:px-3 py-2 border border-primary/30 focus:outline-none cursor-pointer w-full sm:w-auto"
              >
                <option value="all">All Days</option>
                {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d.toString()}>
                    Day {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Results Count */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text/60 px-1">
            <span>Showing {filteredItems.length} items</span>
            {filteredItems.length > 0 && (
              <span>
                Filtered Total: <strong className="text-text font-bold">{formatAmount(filteredItems.reduce((a, b) => a + b.convertedAmount, 0), baseCurrency)}</strong>
              </span>
            )}
          </div>

          {/* Mobile Card List (md:hidden) */}
          <div className="md:hidden space-y-2.5">
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl border border-primary/20 bg-bg/40 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-bold">
                        Day {item.day}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${item.category.bgClass}`}>
                        <span>{item.category.emoji}</span>
                        <span>{item.category.label}</span>
                      </span>
                    </div>
                    <div className="text-right">
                      {item.amount > 0 ? (
                        <div className="text-xs font-bold text-text">
                          {formatAmount(item.convertedAmount, baseCurrency)}
                        </div>
                      ) : (
                        <span className="text-emerald-500 text-xs font-bold">Free</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="font-semibold text-sm text-text">{item.title}</div>
                    {item.description && (
                      <div className="text-xs text-text/65 line-clamp-2 mt-0.5">{item.description}</div>
                    )}
                    {item.note && (
                      <div className="text-[11px] text-text/50 italic mt-0.5">{item.note}</div>
                    )}
                  </div>

                  {item.amount > 0 && (
                    <div className="pt-1.5 border-t border-primary/10 flex items-center justify-between text-[11px] text-text/60">
                      <span>Local Price:</span>
                      <span className="font-semibold text-text/80">{formatAmount(item.amount, item.currency)}</span>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-sm text-text/50 rounded-xl border border-primary/20 bg-bg/20">
                No activities match your filters.
              </div>
            )}
          </div>

          {/* Desktop Expenses Table (hidden on mobile) */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-primary/20 bg-bg/20">
            <table className="w-full text-left text-sm">
              <thead className="bg-bg/60 border-b border-primary/20 text-xs font-semibold text-text/70 uppercase">
                <tr>
                  <th className="px-4 py-3">Day</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Activity & Notes</th>
                  <th className="px-4 py-3 text-right">Local Price</th>
                  <th className="px-4 py-3 text-right">Converted ({baseCurrency})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/10">
                {filteredItems.length > 0 ? (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-bg/40 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-bold">
                          Day {item.day}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${item.category.bgClass}`}>
                          <span>{item.category.emoji}</span>
                          <span>{item.category.label}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-text">{item.title}</div>
                        {item.description && (
                          <div className="text-xs text-text/60 line-clamp-1">{item.description}</div>
                        )}
                        {item.note && (
                          <div className="text-[11px] text-text/40 italic mt-0.5">{item.note}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-text whitespace-nowrap">
                        {item.amount > 0 ? (
                          formatAmount(item.amount, item.currency)
                        ) : (
                          <span className="text-emerald-400 text-xs font-bold">Free</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-text whitespace-nowrap">
                        {item.amount > 0 ? (
                          formatAmount(item.convertedAmount, baseCurrency)
                        ) : (
                          <span className="text-emerald-400 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-text/50">
                      No activities match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsDashboard;
