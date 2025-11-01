'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CandlestickChart from '../components/CandlestickChart';
import { fetchStockData } from '../lib/yahooFinance';

export default function LevelUpPage() {
  const router = useRouter();
  const [ticker, setTicker] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!ticker || !startDate || !endDate) {
        throw new Error('Заполните все поля');
      }

      if (new Date(startDate) >= new Date(endDate)) {
        throw new Error('Дата начала должна быть раньше даты конца');
      }

      const data = await fetchStockData(ticker, startDate, endDate);
      
      if (!data || data.length === 0) {
        throw new Error('Данные не найдены для указанного периода');
      }

      setChartData(data);
    } catch (err) {
      setError(err.message || 'Ошибка при загрузке данных');
      setChartData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Навигационная шапка */}
      <div className="bg-white shadow-md border-b border-gray-200">
        <div className="flex gap-4 p-4">
          <button 
            className="px-8 py-3 bg-green-500 text-white rounded-full font-medium shadow-lg"
          >
            Level Up
          </button>
          <button 
            onClick={() => router.push('/leveldown')}
            className="px-8 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-full font-medium transition-colors"
          >
            Level Down
          </button>
          <button 
            onClick={() => router.push('/level1')}
            className="px-8 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-full font-medium transition-colors"
          >
            Level1
          </button>
          <button 
            onClick={() => router.push('/level2')}
            className="px-8 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-full font-medium transition-colors"
          >
            Level2
          </button>
        </div>
      </div>

      <div className="flex">
        <div className="w-64 bg-[#8B9A8B] min-h-screen p-6">
          <h2 className="text-white text-xl font-semibold mb-8">Level Up Analysis</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              placeholder="тикер"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              className="w-full px-4 py-2 rounded-lg bg-gray-200 text-gray-800 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />

            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-gray-200 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />

            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-gray-200 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2 rounded-lg text-white font-medium transition-colors ${
                loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'
              }`}
            >
              {loading ? 'Загрузка...' : 'Построить график'}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="mt-8 text-white/80 text-sm">
            <p className="font-medium mb-2">Популярные тикеры:</p>
            <div className="space-y-1">
              {['MSFT', 'AAPL', 'GOOGL', 'TSLA'].map(t => (
                <button
                  key={t}
                  onClick={() => setTicker(t)}
                  className="block hover:text-white transition-colors"
                >
                  • {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 p-8">
          <div className="bg-white rounded-2xl shadow-xl p-6 min-h-[600px]">
            {!chartData && !loading && (
              <div className="flex items-center justify-center h-[500px]">
                <div className="text-center">
                  <p className="text-gray-500 text-lg">Введите данные для построения графика</p>
                </div>
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center h-[500px]">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                  <p className="text-gray-500 mt-4">Загрузка данных...</p>
                </div>
              </div>
            )}

            {chartData && !loading && (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-gray-800">
                    {ticker} - График с линией поддержки
                  </h3>
                  <div className="text-sm text-gray-600">
                    {startDate} - {endDate}
                  </div>
                </div>
                <CandlestickChart data={chartData} ticker={ticker} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}