'use client';

import { useEffect, useRef, useState } from 'react';
import { calculateExponentialResistanceLine } from '../lib/level2Analysis';
import * as XLSX from 'xlsx';

export default function Level2Chart({ data, ticker }) {
  const canvasRef = useRef(null);
  const [resistanceLine, setResistanceLine] = useState(null);
  const [hoveredCandle, setHoveredCandle] = useState(null);

  const downloadExcel = () => {
    if (!resistanceLine || !ticker) return;

    const point1 = resistanceLine.points[0];
    const point2 = resistanceLine.points[1];
    const strategy = resistanceLine.tradingStrategy;

    // Создаем данные для Excel в одну строку
    const excelData = [
      [
        ticker, // A1
        point1.price.toFixed(2), // A2
        point2.price.toFixed(2), // A3
        point1.index + 1, // Номер дня 1
        point2.index + 1, // Номер дня 2
        resistanceLine.percentPerDayPercent + '%', // Процент в день
        strategy ? strategy.avgPercentPerDay + '%' : 'N/A', // Средний % в день (торговля)
        strategy ? strategy.entryPercent + '%' : 'N/A', // % для входа (SHORT)
        strategy ? strategy.exitPercent + '%' : 'N/A' // % для выхода (SHORT)
      ]
    ];

    // Создаем рабочую книгу
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(excelData);

    // Добавляем лист в книгу
    XLSX.utils.book_append_sheet(wb, ws, 'Level2 Resistance');

    // Скачиваем файл
    XLSX.writeFile(wb, `${ticker}_level2_resistance.xlsx`);
  };

  useEffect(() => {
    if (!data || data.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    canvas.width = canvas.offsetWidth;
    canvas.height = 400;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const prices = data.flatMap(d => [d.high, d.low]);
    const minPrice = Math.min(...prices) * 0.995;
    const maxPrice = Math.max(...prices) * 1.005;
    const priceRange = maxPrice - minPrice;

    const padding = 60;
    const chartWidth = canvas.width - padding * 2;
    const chartHeight = canvas.height - padding * 2;
    const candleWidth = chartWidth / data.length * 0.6;
    const candleSpacing = chartWidth / data.length;

    const priceToY = (price) => {
      return padding + (1 - (price - minPrice) / priceRange) * chartHeight;
    };

    const indexToX = (index) => {
      return padding + index * candleSpacing + candleSpacing / 2;
    };

    // Рисуем сетку
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 0.5;
    
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

    // Рассчитываем экспоненциальную линию сопротивления
    const resistance = calculateExponentialResistanceLine(data);
    setResistanceLine(resistance);

    // Рисуем экспоненциальную кривую сопротивления
    if (resistance && resistance.curvePoints) {
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 3;
      ctx.beginPath();
      
      resistance.curvePoints.forEach((point, i) => {
        const x = indexToX(point.index);
        const y = priceToY(point.price);
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.stroke();
      
      ctx.fillStyle = '#dc2626';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Resistance (Exponential)', canvas.width - padding + 10, priceToY(resistance.endPrice) + 4);
    }

    // Рисуем свечи
    data.forEach((candle, index) => {
      const x = indexToX(index);
      const isGreen = candle.close > candle.open;
      
      ctx.strokeStyle = isGreen ? '#10b981' : '#ef4444';
      ctx.fillStyle = isGreen ? 'rgba(16, 185, 129, 0.8)' : 'rgba(239, 68, 68, 0.8)';
      
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, priceToY(candle.high));
      ctx.lineTo(x, priceToY(candle.low));
      ctx.stroke();
      
      const bodyTop = priceToY(Math.max(candle.open, candle.close));
      const bodyHeight = Math.abs(priceToY(candle.open) - priceToY(candle.close));
      
      ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
      ctx.strokeRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
      
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
    return () => canvas.removeEventListener('mousemove', handleMouseMove);
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
            <div className="text-black">Open: ${hoveredCandle.open.toFixed(2)}</div>
            <div className="text-black">High: ${hoveredCandle.high.toFixed(2)}</div>
            <div className="text-black">Low: ${hoveredCandle.low.toFixed(2)}</div>
            <div className="text-black">Close: ${hoveredCandle.close.toFixed(2)}</div>
            <div className={hoveredCandle.close > hoveredCandle.open ? 'text-green-600' : 'text-red-600'}>
              {hoveredCandle.close > hoveredCandle.open ? '↑' : '↓'} 
              {Math.abs(hoveredCandle.close - hoveredCandle.open).toFixed(2)} 
              ({((hoveredCandle.close - hoveredCandle.open) / hoveredCandle.open * 100).toFixed(2)}%)
            </div>
          </div>
        </div>
      )}

      {resistanceLine && (
        <div className="mt-4 space-y-4">
          <div className="flex justify-end mb-2">
            <button
              onClick={downloadExcel}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              📥 Скачать Excel
            </button>
          </div>

          {/* Новый блок с оптимальной стратегией SHORT */}
          {resistanceLine.tradingStrategy && (
            <div className="p-4 bg-gradient-to-r from-red-50 to-orange-50 rounded-lg border-2 border-red-300">
              <h4 className="font-semibold text-lg mb-3 text-red-900">🎯 Оптимальная торговая стратегия (SHORT):</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-600 mb-1">Средний % в день</div>
                  <div className="text-2xl font-bold text-red-600">
                    {resistanceLine.tradingStrategy.avgPercentPerDay}%
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-600 mb-1">Всего сделок</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {resistanceLine.tradingStrategy.totalTrades}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-600 mb-1">% для входа (SHORT)</div>
                  <div className="text-xl font-bold text-purple-600">
                    -{resistanceLine.tradingStrategy.entryPercent}%
                  </div>
                  <div className="text-xs text-gray-500 mt-1">от уровня сопротивления</div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-600 mb-1">% для выхода (выкуп)</div>
                  <div className="text-xl font-bold text-orange-600">
                    -{resistanceLine.tradingStrategy.exitPercent}%
                  </div>
                  <div className="text-xs text-gray-500 mt-1">от уровня сопротивления</div>
                </div>
              </div>
              <div className="mt-3 p-2 bg-white rounded text-sm text-gray-700">
                <strong>Общая прибыль:</strong> {resistanceLine.tradingStrategy.totalProfit}%
              </div>
              <div className="mt-2 p-2 bg-yellow-50 rounded text-xs text-gray-700">
                <strong>ℹ️ SHORT стратегия:</strong> Продаем когда цена достигает уровня (Сопротивление × (1 - {resistanceLine.tradingStrategy.entryPercent}%)), выкупаем когда падает до (Сопротивление × (1 - {resistanceLine.tradingStrategy.exitPercent}%))
              </div>
            </div>
          )}

          <div className="p-4 bg-red-50 rounded-lg border-2 border-red-200">
            <h4 className="font-semibold text-base mb-3 text-red-900">📊 Точки экспоненциальной линии сопротивления:</h4>
            <div className="space-y-3">
              {resistanceLine.points.map((point, idx) => {
                const candle = data[point.index];
                const date = new Date(candle.date);
                return (
                  <div key={idx} className="bg-white p-3 rounded-lg shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-red-700">Точка {idx + 1}:</span>
                        <span className="ml-2 text-lg font-bold text-gray-800">${point.price.toFixed(2)}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-600">
                          {date.toLocaleDateString('ru-RU', { 
                            day: '2-digit', 
                            month: 'long', 
                            year: 'numeric' 
                          })}
                        </div>
                        <div className="text-xs text-gray-500">
                          День #{point.index + 1} из {data.length}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-4 bg-orange-50 rounded-lg">
            <h4 className="font-semibold text-sm mb-2 text-black">Характеристики экспоненциальной линии сопротивления:</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Начальный уровень:</span>
                <span className="ml-2 font-medium text-black">${resistanceLine.startPrice.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-600">Конечный уровень:</span>
                <span className="ml-2 font-medium text-black">${resistanceLine.endPrice.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-600">Процент изменения в день:</span>
                <span className="ml-2 font-medium text-red-600">{resistanceLine.percentPerDayPercent}%</span>
              </div>
              <div>
                <span className="text-gray-600">Количество касаний:</span>
                <span className="ml-2 font-medium text-red-600">{resistanceLine.touches}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}