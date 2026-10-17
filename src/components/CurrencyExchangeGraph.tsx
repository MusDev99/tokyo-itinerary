import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  Filler,
} from 'chart.js';
import { fetchHistoricalRates, type HistoricalRateItem } from '../utils/analytics';

ChartJS.register(
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  Filler
);

interface CurrencyExchangeGraphProps {
  baseCurrency?: string;
  targetCurrency?: string;
  availableTargets?: string[];
  onTargetChange?: (target: string) => void;
}

export const CurrencyExchangeGraph: React.FC<CurrencyExchangeGraphProps> = ({
  baseCurrency = 'MYR',
  targetCurrency = 'JPY',
  availableTargets = ['JPY', 'KZT', 'CNY', 'TRY', 'AUD', 'USD', 'EUR'],
  onTargetChange,
}) => {
  const [timeframe, setTimeframe] = useState<7 | 14 | 30>(14);
  const [dataPoints, setDataPoints] = useState<HistoricalRateItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    fetchHistoricalRates(baseCurrency, targetCurrency, timeframe)
      .then((points) => {
        if (!isMounted) return;
        setDataPoints(points);
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Error fetching rate history:', err);
        setError('Failed to load exchange rate history.');
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [baseCurrency, targetCurrency, timeframe]);

  // Derived stats
  const rates = dataPoints.map((p) => p.rate);
  const minRate = rates.length > 0 ? Math.min(...rates) : 0;
  const maxRate = rates.length > 0 ? Math.max(...rates) : 0;
  const firstRate = rates.length > 0 ? rates[0] : 0;
  const latestRate = rates.length > 0 ? rates[rates.length - 1] : 0;
  const changePercent = firstRate > 0 ? ((latestRate - firstRate) / firstRate) * 100 : 0;
  const isUp = changePercent >= 0;

  const chartData = {
    labels: dataPoints.map((p) => {
      const parts = p.date.split('-');
      return `${parts[1]}/${parts[2]}`;
    }),
    datasets: [
      {
        label: `1 ${baseCurrency} → ${targetCurrency}`,
        data: dataPoints.map((p) => p.rate),
        borderColor: isUp ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)',
        backgroundColor: isUp ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
        fill: true,
        tension: 0.35,
        pointRadius: timeframe <= 14 ? 4 : 2,
        pointHoverRadius: 6,
        pointBackgroundColor: isUp ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 1.5,
      },
    ],
  };

  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        titleColor: '#f3f4f6',
        bodyColor: '#e5e7eb',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        padding: 10,
        displayColors: false,
        callbacks: {
          label: (context: any) => `Rate: ${context.parsed.y} ${targetCurrency}`,
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(156, 163, 175, 0.1)',
        },
        ticks: {
          color: 'rgba(156, 163, 175, 0.8)',
          font: { size: 11 },
          maxRotation: 0,
        },
      },
      y: {
        grid: {
          color: 'rgba(156, 163, 175, 0.1)',
        },
        ticks: {
          color: 'rgba(156, 163, 175, 0.8)',
          font: { size: 11 },
          callback: (value: any) => Number(value).toFixed(2),
        },
      },
    },
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-text/60 font-semibold">Pair:</span>
          <div className="flex flex-wrap gap-1">
            {availableTargets.map((curr) => (
              <button
                key={curr}
                type="button"
                onClick={() => onTargetChange?.(curr)}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                  targetCurrency === curr
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-primary/10 text-text/80 hover:bg-primary/20'
                }`}
              >
                {curr}
              </button>
            ))}
          </div>
        </div>

        {/* Timeframe selector */}
        <div className="flex items-center gap-1 bg-bg/60 p-1 rounded-lg border border-primary/20">
          {([7, 14, 30] as const).map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setTimeframe(days)}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                timeframe === days
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text/70 hover:text-text'
              }`}
            >
              {days}D
            </button>
          ))}
        </div>
      </div>

      {/* Snapshot metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-2.5 rounded-lg bg-bg/40 border border-primary/15">
          <div className="text-[11px] text-text/60">Current Rate</div>
          <div className="text-base font-bold text-text">
            {latestRate ? latestRate.toFixed(3) : '—'} <span className="text-xs font-normal text-text/60">{targetCurrency}</span>
          </div>
        </div>
        <div className="p-2.5 rounded-lg bg-bg/40 border border-primary/15">
          <div className="text-[11px] text-text/60">{timeframe}D Change</div>
          <div className={`text-base font-bold flex items-center gap-1 ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
            <span>{isUp ? '▲' : '▼'}</span>
            <span>{Math.abs(changePercent).toFixed(2)}%</span>
          </div>
        </div>
        <div className="p-2.5 rounded-lg bg-bg/40 border border-primary/15">
          <div className="text-[11px] text-text/60">{timeframe}D Low</div>
          <div className="text-base font-semibold text-text">
            {minRate ? minRate.toFixed(3) : '—'}
          </div>
        </div>
        <div className="p-2.5 rounded-lg bg-bg/40 border border-primary/15">
          <div className="text-[11px] text-text/60">{timeframe}D High</div>
          <div className="text-base font-semibold text-text">
            {maxRate ? maxRate.toFixed(3) : '—'}
          </div>
        </div>
      </div>

      {/* Chart container */}
      <div className="relative h-64 sm:h-72 w-full rounded-xl bg-bg/30 p-3 border border-primary/15 flex items-center justify-center">
        {loading ? (
          <div className="flex flex-col items-center gap-2 text-text/60 text-sm">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <span>Fetching historical rates...</span>
          </div>
        ) : error ? (
          <div className="text-center text-red-400 text-sm">
            {error}
          </div>
        ) : (
          <Line data={chartData} options={chartOptions} />
        )}
      </div>
    </div>
  );
};

export default CurrencyExchangeGraph;