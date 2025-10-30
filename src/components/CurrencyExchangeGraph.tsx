import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

import type { CurrencyExchangeData, HistoricalCurrencyResponse } from '../types/currency';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface CurrencyDataPoint {
  date: string;
  value: number;
}

const CurrencyExchangeGraph = () => {
  const [chartData, setChartData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('🚀 Component mounted, fetching data...');
    
    const fetchCurrencyData = async () => {
      try {
        setLoading(true);
        console.log('📡 Making request to /api/currency-exchange');
        
        const response = await fetch('/api/currency-exchange', {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        console.log('📥 Response received:', response.status, response.statusText);

        if (!response.ok) {
          const errorData = await response.text();
          console.error('❌ Error response:', errorData);
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const apiResponse: HistoricalCurrencyResponse = await response.json();
        console.log('✅ API Response:', apiResponse);

        if (!apiResponse || !apiResponse.data || !Array.isArray(apiResponse.data)) {
          throw new Error('Invalid API response structure');
        }

        if (apiResponse.data.length === 0) {
          throw new Error('No data returned from API');
        }

        const processedData: CurrencyDataPoint[] = apiResponse.data.map(item => ({
          date: item.rowDate,
          value: parseFloat(item.last_closeRaw),
        }));

        processedData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        console.log('📊 Processed data points:', processedData.length);

        setChartData({
          labels: processedData.map(data => data.date),
          datasets: [
            {
              label: 'JPY/MYR Exchange Rate',
              data: processedData.map(data => data.value),
              borderColor: 'rgb(75, 192, 192)',
              backgroundColor: 'rgba(75, 192, 192, 0.5)',
              tension: 0.1,
              fill: false,
            },
          ],
        });
      } catch (e: any) {
        console.error("💥 Failed to fetch currency data:", e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCurrencyData();
  }, []); // Empty dependency array

  if (loading) {
    return <div className="text-center py-4">⏳ Loading currency data...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-4 text-red-500">
        <p>❌ Error: {error}</p>
        <p className="text-sm mt-2">Check browser console for details</p>
      </div>
    );
  }

  if (!chartData) {
    return <div className="text-center py-4">📊 No data available.</div>;
  }

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'JPY/MYR Exchange Rate (Last 30 Days)',
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Date',
        },
      },
      y: {
        title: {
          display: true,
          text: 'Exchange Rate (MYR)',
        },
      },
    },
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md max-w-3xl mx-auto my-8">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        📈 Currency Exchange Graph
      </h2>
      <Line data={chartData} options={options} />
    </div>
  );
};

export default CurrencyExchangeGraph;