// src/app/levelup/page.jsx
'use client';

import { useState } from 'react';
import CandlestickChart from '@/components/CandlestickChart';
import { fetchStockData } from '@/lib/yahooFinance';

export default function LevelUpPage() {
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
      // Валидация данных
      if (!ticker || !startDate || !endDate) {
        throw new Error('Заполните все поля');
      }

      if (new Date(startDate) >= new Date(endDate)) {
        throw new Error('Дата начала должна быть раньше даты конца');
      }

      // Получаем данные с Yahoo Finance
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
      {/* Левая панель с формой */}
      <div className="flex">
        <div className="w-64 bg-[#8B9A8B] min-h-screen p-6">
          <h2 className="text-white text-xl font-semibold mb-8">Level Up Analysis</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                placeholder="тикер"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                className="w-full px-4 py-2 rounded-lg bg-gray-200 text-gray-800 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <div>
              <input
                type="date"
                placeholder="дата начала"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-gray-200 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <div>
              <input
                type="date"
                placeholder="дата конца"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-gray-200 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2 rounded-lg text-white font-medium transition-colors ${
                loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600'
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

          {/* Примеры тикеров */}
          <div className="mt-8 text-white/80 text-sm">
            <p className="font-medium mb-2">Популярные тикеры:</p>
            <div className="space-y-1">
              <button
                onClick={() => setTicker('MSFT')}
                className="block hover:text-white transition-colors"
              >
                • MSFT - Microsoft
              </button>
              <button
                onClick={() => setTicker('AAPL')}
                className="block hover:text-white transition-colors"
              >
                • AAPL - Apple
              </button>
              <button
                onClick={() => setTicker('GOOGL')}
                className="block hover:text-white transition-colors"
              >
                • GOOGL - Google
              </button>
              <button
                onClick={() => setTicker('TSLA')}
                className="block hover:text-white transition-colors"
              >
                • TSLA - Tesla
              </button>
            </div>
          </div>
        </div>

        {/* Правая панель с графиком */}
        <div className="flex-1 p-8">
          <div className="bg-white rounded-2xl shadow-xl p-6 min-h-[600px]">
            {!chartData && !loading && (
              <div className="flex items-center justify-center h-[500px]">
                <div className="text-center">
                  <svg
                    className="w-24 h-24 mx-auto text-gray-300 mb-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                  <p className="text-gray-500 text-lg">
                    Введите данные для построения графика
                  </p>
                  <p className="text-gray-400 text-sm mt-2">
                    Выберите тикер и период для анализа
                  </p>
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

// ===================================================================
// src/components/CandlestickChart.jsx
// ===================================================================
'use client';

import { useEffect, useRef, useState } from 'react';
import { calculateSupportLine } from '@/lib/technicalAnalysis';

export default function CandlestickChart({ data, ticker }) {
  const canvasRef = useRef(null);
  const [supportLine, setSupportLine] = useState(null);
  const [hoveredCandle, setHoveredCandle] = useState(null);

  useEffect(() => {
    if (!data || data.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Установка размеров canvas
    canvas.width = canvas.offsetWidth;
    canvas.height = 400;

    // Очистка canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Расчет минимальной и максимальной цены
    const prices = data.flatMap(d => [d.high, d.low]);
    const minPrice = Math.min(...prices) * 0.995;
    const maxPrice = Math.max(...prices) * 1.005;
    const priceRange = maxPrice - minPrice;

    // Параметры отрисовки
    const padding = 60;
    const chartWidth = canvas.width - padding * 2;
    const chartHeight = canvas.height - padding * 2;
    const candleWidth = chartWidth / data.length * 0.6;
    const candleSpacing = chartWidth / data.length;

    // Функция преобразования цены в координату Y
    const priceToY = (price) => {
      return padding + (1 - (price - minPrice) / priceRange) * chartHeight;
    };

    // Отрисовка сетки
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.5;
    
    // Горизонтальные линии и метки цен
    const priceSteps = 5;
    for (let i = 0; i <= priceSteps; i++) {
      const price = minPrice + (priceRange * i) / priceSteps;
      const y = priceToY(price);
      
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(canvas.width - padding, y);
      ctx.stroke();
      
      ctx.fillStyle = '#6b7280';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`$${price.toFixed(2)}`, padding - 10, y + 4);
    }

    // Расчет линии поддержки
    const support = calculateSupportLine(data);
    setSupportLine(support);

    // Отрисовка линии поддержки
    if (support) {
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(padding, priceToY(support.startPrice));
      ctx.lineTo(canvas.width - padding, priceToY(support.endPrice));
      ctx.stroke();
      
      // Подпись линии
      ctx.fillStyle = '#2563eb';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Support', canvas.width - padding + 10, priceToY(support.endPrice) + 4);
    }

    // Отрисовка свечей
    data.forEach((candle, index) => {
      const x = padding + index * candleSpacing + candleSpacing / 2;
      const isGreen = candle.close > candle.open;
      
      // Цвета
      ctx.strokeStyle = isGreen ? '#10b981' : '#ef4444';
      ctx.fillStyle = isGreen ? 'rgba(16, 185, 129, 0.8)' : 'rgba(239, 68, 68, 0.8)';
      
      // Фитиль
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, priceToY(candle.high));
      ctx.lineTo(x, priceToY(candle.low));
      ctx.stroke();
      
      // Тело свечи
      const bodyTop = priceToY(Math.max(candle.open, candle.close));
      const bodyHeight = Math.abs(priceToY(candle.open) - priceToY(candle.close));
      
      ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
      ctx.strokeRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
      
      // Дата под графиком
      if (index % Math.ceil(data.length / 10) === 0) {
        ctx.fillStyle = '#374151';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        const date = new Date(candle.date);
        ctx.fillText(
          `${date.getDate()}.${String(date.getMonth() + 1).padStart(2, '0')}`,
          x,
          canvas.height - padding + 20
        );
      }
    });

    // Обработка наведения мыши
    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const index = Math.floor((x - padding) / candleSpacing);
      
      if (index >= 0 && index < data.length) {
        setHoveredCandle({ ...data[index], index });
      } else {
        setHoveredCandle(null);
      }
    };

    canvas.addEventListener('mousemove', handleMouseMove);

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
    };
  }, [data]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="w-full cursor-crosshair"
        style={{ height: '400px' }}
      />
      
      {hoveredCandle && (
        <div className="absolute top-4 left-4 bg-white p-3 rounded-lg shadow-lg border border-gray-200 text-sm">
          <div className="font-semibold mb-1">
            {new Date(hoveredCandle.date).toLocaleDateString('ru-RU')}
          </div>
          <div className="space-y-0.5 text-xs">
            <div>Open: ${hoveredCandle.open.toFixed(2)}</div>
            <div>High: ${hoveredCandle.high.toFixed(2)}</div>
            <div>Low: ${hoveredCandle.low.toFixed(2)}</div>
            <div>Close: ${hoveredCandle.close.toFixed(2)}</div>
            <div className={hoveredCandle.close > hoveredCandle.open ? 'text-green-600' : 'text-red-600'}>
              {hoveredCandle.close > hoveredCandle.open ? '↑' : '↓'} 
              {' '}
              {Math.abs(hoveredCandle.close - hoveredCandle.open).toFixed(2)} 
              {' '}
              ({((hoveredCandle.close - hoveredCandle.open) / hoveredCandle.open * 100).toFixed(2)}%)
            </div>
          </div>
        </div>
      )}

      {supportLine && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-semibold text-sm mb-2">Анализ линии поддержки:</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Начальный уровень:</span>
              <span className="ml-2 font-medium">${supportLine.startPrice.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-600">Текущий уровень:</span>
              <span className="ml-2 font-medium">${supportLine.endPrice.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-600">Угол наклона:</span>
              <span className="ml-2 font-medium">
                ${supportLine.slope.toFixed(2)}/день
              </span>
            </div>
            <div>
              <span className="text-gray-600">Сила:</span>
              <span className="ml-2 font-medium text-green-600">
                {supportLine.touches} касания
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===================================================================
// src/lib/yahooFinance.js
// ===================================================================
const yahooFinance = require('yahoo-finance2').default;

export async function fetchStockData(ticker, startDate, endDate) {
  try {
    const result = await yahooFinance.chart(ticker, {
      period1: startDate,
      period2: endDate,
      interval: '1d'
    });
    
    return result.quotes.map(quote => ({
      date: quote.date,
      open: quote.open,
      high: quote.high,
      low: quote.low,
      close: quote.close,
      volume: quote.volume
    }));
  } catch (error) {
    console.error('Error fetching stock data:', error);
    throw new Error('Не удалось получить данные для тикера ' + ticker);
  }
}

// ===================================================================
// src/lib/technicalAnalysis.js
// ===================================================================
export function calculateSupportLine(data) {
  if (!data || data.length < 3) return null;
  
  // Находим локальные минимумы
  const lows = data.map((d, i) => ({
    price: d.low,
    index: i,
    date: d.date
  }));
  
  // Сортируем по цене
  const sortedLows = [...lows].sort((a, b) => a.price - b.price);
  
  // Берем 3 самых низких точки
  const supportPoints = sortedLows.slice(0, 3);
  
  // Сортируем по времени
  supportPoints.sort((a, b) => a.index - b.index);
  
  // Расчет линейной регрессии
  const n = supportPoints.length;
  const sumX = supportPoints.reduce((sum, p) => sum + p.index, 0);
  const sumY = supportPoints.reduce((sum, p) => sum + p.price, 0);
  const sumXY = supportPoints.reduce((sum, p) => sum + p.index * p.price, 0);
  const sumX2 = supportPoints.reduce((sum, p) => sum + p.index * p.index, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  // Расчет начальной и конечной точки линии
  const startPrice = intercept;
  const endPrice = intercept + slope * (data.length - 1);
  
  // Подсчет касаний
  let touches = 0;
  data.forEach((candle, i) => {
    const linePrice = intercept + slope * i;
    if (Math.abs(candle.low - linePrice) / linePrice < 0.01) { // В пределах 1%
      touches++;
    }
  });
  
  return {
    startPrice,
    endPrice,
    slope,
    intercept,
    touches,
    points: supportPoints
  };
}