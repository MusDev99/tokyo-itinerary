import React, { useState, useEffect } from 'react';
import type { DayItinerary, Price } from '../types/itinerary';

interface AnalyticsDashboardProps {
  itinerary: DayItinerary[];
}

interface CostSummary {
  currency: string;
  total: number;
  itemCount: number;
  averagePerItem: number;
  items: Array<{
    day: number;
    title: string;
    amount: number;
    notes?: string;
  }>;
}

const AnalyticsDashboard = ({ itinerary }: AnalyticsDashboardProps) => {
  const [costSummary, setCostSummary] = useState<CostSummary[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    calculateCosts();
  }, [itinerary]);

  const calculateCosts = () => {
    const currencyMap = new Map<string, CostSummary>();

    itinerary.forEach((day) => {
      day.items.forEach((item) => {
        const { amount, currency, notes } = item.price;
        
        if (amount > 0) { // Only include items with actual costs
          if (!currencyMap.has(currency)) {
            currencyMap.set(currency, {
              currency,
              total: 0,
              itemCount: 0,
              averagePerItem: 0,
              items: []
            });
          }

          const summary = currencyMap.get(currency)!;
          summary.total += amount;
          summary.itemCount += 1;
          summary.items.push({
            day: day.day,
            title: item.title,
            amount,
            notes
          });
        }
      });
    });

    // Calculate averages and sort by total amount
    const summaries = Array.from(currencyMap.values()).map(summary => ({
      ...summary,
      averagePerItem: summary.total / summary.itemCount
    })).sort((a, b) => b.total - a.total);

    setCostSummary(summaries);
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency === 'MYR' ? 'MYR' : 'JPY',
      minimumFractionDigits: currency === 'JPY' ? 0 : 2,
      maximumFractionDigits: currency === 'JPY' ? 0 : 2,
    }).format(amount);
  };

  const getCurrencySymbol = (currency: string) => {
    return currency === 'MYR' ? 'RM' : '¥';
  };

  const getCurrencyColor = (currency: string) => {
    return currency === 'MYR' ? 'text-green-600' : 'text-blue-600';
  };

  const getCurrencyBgColor = (currency: string) => {
    return currency === 'MYR' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200';
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="text-lg font-semibold text-text">Cost Analytics</h3>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-text/70 hover:text-text transition-colors rounded-lg hover:bg-bg/50 cursor-pointer"
          type="button"
        >
          <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
          <svg 
            className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : 'rotate-0'}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {costSummary.map((summary) => (
          <div 
            key={summary.currency}
            className={`p-4 rounded-lg border ${getCurrencyBgColor(summary.currency)}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${summary.currency === 'MYR' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                <span className="font-medium text-text">{summary.currency}</span>
              </div>
              <span className={`text-2xl font-bold ${getCurrencyColor(summary.currency)}`}>
                {getCurrencySymbol(summary.currency)}{summary.total.toLocaleString()}
              </span>
            </div>
            <div className="text-sm text-text/70">
              {summary.itemCount} items • Avg: {getCurrencySymbol(summary.currency)}{summary.averagePerItem.toFixed(2)}
            </div>
          </div>
        ))}
      </div>

      {/* Detailed Breakdown */}
      {isExpanded && (
        <div className="space-y-4">
          {costSummary.map((summary) => (
            <div key={summary.currency} className="bg-bg/30 rounded-lg p-4 border border-primary/10">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-text flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${summary.currency === 'MYR' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                  {summary.currency} Breakdown
                </h4>
                <span className={`text-lg font-bold ${getCurrencyColor(summary.currency)}`}>
                  {getCurrencySymbol(summary.currency)}{summary.total.toLocaleString()}
                </span>
              </div>
              
              <div className="space-y-2">
                {summary.items.map((item, index) => (
                  <div key={index} className="flex items-center justify-between py-2 px-3 bg-bg/20 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-sm text-text">{item.title}</div>
                      <div className="text-xs text-text/60">Day {item.day}</div>
                      {item.notes && (
                        <div className="text-xs text-text/50 italic">{item.notes}</div>
                      )}
                    </div>
                    <div className={`font-semibold ${getCurrencyColor(summary.currency)}`}>
                      {getCurrencySymbol(summary.currency)}{item.amount.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Total Summary */}
      {costSummary.length > 0 && (
        <div className="mt-4 p-4 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg border border-primary/20">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-text">Total Trip Cost</span>
            <div className="text-right">
              {costSummary.map((summary, index) => (
                <div key={summary.currency} className="text-sm">
                  <span className={getCurrencyColor(summary.currency)}>
                    {getCurrencySymbol(summary.currency)}{summary.total.toLocaleString()} {summary.currency}
                  </span>
                  {index < costSummary.length - 1 && <span className="text-text/50 mx-2">+</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsDashboard;
