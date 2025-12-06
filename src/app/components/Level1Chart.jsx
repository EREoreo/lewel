'use client';

import { useEffect, useRef, useState } from 'react';
import { calculateExponentialSupportLine, calculateExponentialSupportLineWithTest } from '../lib/level1Analysis';
import * as XLSX from 'xlsx';

export default function Level1Chart({ 
  data, 
  ticker, 
  testPeriodDays = null, 
  point1MaxDay = null, 
  point2MinDay = null, 
  minTradesPercent = 0,
  entryMultiplier = 1.0,  // 🆕
  exitMultiplier = 1.0     // 🆕
}) {
  const canvasRef = useRef(null);
  const [supportLine, setSupportLine] = useState(null);
  const [hoveredCandle, setHoveredCandle] = useState(null);

  const downloadExcel = () => {
    if (!supportLine || !ticker) return;

    const point1 = supportLine.points[0];
    const point2 = supportLine.points[1];
    const strategy = supportLine.testStrategy || supportLine.tradingStrategy;

    let excelData;
    if (supportLine.testPeriodDays) {
      // Режим с разделением на участки - РАСШИРЕННЫЙ ФОРМАТ
      excelData = [
        ['Тикер', ticker],
        ['', ''],
        ['📊 ПАРАМЕТРЫ ЛИНИИ'],
        ['Точка 1 (день)', point1.index + 1],
        ['Точка 1 (цена)', parseFloat(point1.price.toFixed(2))],
        ['Точка 2 (день)', point2.index + 1],
        ['Точка 2 (цена)', parseFloat(point2.price.toFixed(2))],
        ['Процент в день', parseFloat(supportLine.percentPerDayPercent)],
        ['', ''],
        ['🔬 ТЕСТИРУЕМЫЙ УЧАСТОК (дни 1-' + supportLine.testPeriodDays + ')'],
        ['Средний % в день', parseFloat(strategy?.avgPercentPerDay || 0)],
        ['% для входа', parseFloat(strategy?.entryPercent || 0)],
        ['% для выхода', parseFloat(strategy?.exitPercent || 0)],
        ['Трейды (чистые)', strategy?.totalTrades || 0],
        ['Всего дней', strategy?.totalDays || 0],
        ['Закрыто по факту', strategy?.hasFactClose || 0],
        ['Процент сделок', parseFloat(strategy?.tradesPercent || 0)],
        ['Общая прибыль', parseFloat(strategy?.totalProfit || 0)],
        ['', ''],
        ['🧪 ИССЛЕДУЕМЫЙ УЧАСТОК (дни ' + (supportLine.testPeriodDays + 1) + '-' + (supportLine.researchEndIndex + 1) + ')'],
        ['Средний % в день', parseFloat(supportLine.researchStrategy?.avgPercentPerDay || 0)],
        ['% для входа (×МН)', parseFloat(supportLine.researchStrategy?.entryPercent || 0)],
        ['% для выхода (×МН)', parseFloat(supportLine.researchStrategy?.exitPercent || 0)],
        ['Трейды (чистые)', supportLine.researchStrategy?.totalTrades || 0],
        ['Всего дней', supportLine.researchStrategy?.totalDays || 0],
        ['Закрыто по факту', supportLine.researchStrategy?.hasFactClose || 0],
        ['Процент сделок', parseFloat(supportLine.researchStrategy?.tradesPercent || 0)],
        ['Общая прибыль', parseFloat(supportLine.researchStrategy?.totalProfit || 0)],
        ['', ''],
        ['⚠️ ПЕРЕСЕЧЕНИЕ', supportLine.hasCrossing ? 'Да' : 'Нет'],
        ['', ''],
        ['🔢 МНОЖИТЕЛИ'],
        ['Множитель входа', supportLine.entryMultiplier || 1.0],
        ['Множитель выхода', supportLine.exitMultiplier || 1.0]
      ];
    } else {
      // Обычный режим - с заголовками
      excelData = [
        // ЗАГОЛОВКИ
        [
          'Тикер',
          'Цена точки 1',
          'Цена точки 2',
          'День 1',
          'День 2',
          'Процент в день',
          'Средний % в день',
          '% для входа',
          '% для выхода',
          'Трейды',
          'Всего дней',
          'Закрыто по факту',
          'Процент сделок'
        ],
        // ДАННЫЕ (без знаков %)
        [
          ticker,
          parseFloat(point1.price.toFixed(2)),
          parseFloat(point2.price.toFixed(2)),
          point1.index + 1,
          point2.index + 1,
          parseFloat(supportLine.percentPerDayPercent),
          parseFloat(strategy?.avgPercentPerDay || 0),
          parseFloat(strategy?.entryPercent || 0),
          parseFloat(strategy?.exitPercent || 0),
          strategy?.totalTrades || 0,
          strategy?.totalDays || 0,
          strategy?.hasFactClose || 0,
          parseFloat(strategy?.tradesPercent || 0)
        ]
      ];
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(excelData);
    XLSX.utils.book_append_sheet(wb, ws, 'Level1 Support');
    XLSX.writeFile(wb, `${ticker}_level1_support.xlsx`);
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

    // Рассчитываем экспоненциальную линию поддержки
    const support = testPeriodDays 
      ? calculateExponentialSupportLineWithTest(
          data, 
          testPeriodDays, 
          point1MaxDay, 
          point2MinDay, 
          minTradesPercent,
          entryMultiplier,  // 🆕
          exitMultiplier    // 🆕
        )
      : calculateExponentialSupportLine(
          data, 
          point1MaxDay, 
          point2MinDay, 
          minTradesPercent
        );
    setSupportLine(support);

    // Рисуем красную разделительную линию, если есть разделение
    if (support && support.testPeriodDays) {
      const dividerX = indexToX(support.testPeriodDays);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(dividerX, padding);
      ctx.lineTo(dividerX, canvas.height - padding);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Подписи участков
      ctx.fillStyle = '#3b82f6';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🔬 тестируемый', dividerX / 2 + padding / 2, padding - 10);
      
      ctx.fillStyle = '#10b981';
      ctx.fillText('🧪 исследуемый', dividerX + (canvas.width - padding - dividerX) / 2, padding - 10);
    }

    // Рисуем экспоненциальную кривую поддержки
    if (support && support.curvePoints) {
      // Основная линия (синяя)
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 3;
      ctx.beginPath();
      
      support.curvePoints.forEach((point, i) => {
        const x = indexToX(point.index);
        const y = priceToY(point.price);
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.stroke();
      
      // Если есть пересечение, рисуем красным после точки пересечения
      if (support.hasCrossing && support.researchEndIndex < data.length - 1) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        
        for (let i = support.researchEndIndex + 1; i < support.curvePoints.length; i++) {
          const point = support.curvePoints[i];
          const x = indexToX(point.index);
          const y = priceToY(point.price);
          
          if (i === support.researchEndIndex + 1) {
            const prevPoint = support.curvePoints[i - 1];
            ctx.moveTo(indexToX(prevPoint.index), priceToY(prevPoint.price));
          }
          ctx.lineTo(x, y);
        }
        
        ctx.stroke();
      }
      
      ctx.fillStyle = '#2563eb';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Support', canvas.width - padding + 10, priceToY(support.endPrice) + 4);
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
  }, [data, testPeriodDays, point1MaxDay, point2MinDay, minTradesPercent, entryMultiplier, exitMultiplier]);

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
            {new Date(hoveredCandle.date).toLocaleDateString('ru-RU')} (День {hoveredCandle.index + 1})
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

      {supportLine && (
        <div className="mt-4 space-y-4">
          <div className="flex justify-end mb-2">
            <button
              onClick={downloadExcel}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              📥 Скачать Excel
            </button>
          </div>

          {/* Тестируемый участок */}
          {supportLine.testStrategy && (
            <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border-2 border-blue-300">
              <h4 className="font-semibold text-lg mb-3 text-blue-900">🔬 Тестируемый участок (дни 1-{supportLine.testPeriodDays}):</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-600 mb-1">Средний % в день</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {supportLine.testStrategy.avgPercentPerDay}%
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-600 mb-1">Трейды (чистые)</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {supportLine.testStrategy.totalTrades}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-600 mb-1">Всего дней</div>
                  <div className="text-xl font-bold text-gray-700">
                    {supportLine.testStrategy.totalDays}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-600 mb-1">Закрыто по факту</div>
                  <div className={`text-xl font-bold ${supportLine.testStrategy.hasFactClose ? 'text-orange-600' : 'text-green-600'}`}>
                    {supportLine.testStrategy.hasFactClose}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-600 mb-1">Процент сделок</div>
                  <div className="text-xl font-bold text-purple-600">
                    {supportLine.testStrategy.tradesPercent}%
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-600 mb-1">% для входа</div>
                  <div className="text-lg font-bold text-purple-600">
                    +{supportLine.testStrategy.entryPercent}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Исследуемый участок */}
          {supportLine.researchStrategy && (
            <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg border-2 border-emerald-300">
              <h4 className="font-semibold text-lg mb-3 text-emerald-900">
                🧪 Исследуемый участок (дни {supportLine.testPeriodDays + 1}-{supportLine.researchEndIndex + 1}):
                {supportLine.entryMultiplier && supportLine.entryMultiplier !== 1.0 && (
                  <span className="ml-2 text-sm text-blue-600">
                    (×{supportLine.entryMultiplier} вход, ×{supportLine.exitMultiplier} выход)
                  </span>
                )}
              </h4>
              {supportLine.hasCrossing && (
                <div className="mb-3 p-2 bg-red-100 border border-red-300 rounded text-sm text-red-800">
                  ⚠️ Линия пересекла свечу - расчеты до дня {supportLine.researchEndIndex + 1}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-600 mb-1">Средний % в день</div>
                  <div className="text-2xl font-bold text-emerald-600">
                    {supportLine.researchStrategy.avgPercentPerDay}%
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-600 mb-1">Трейды (чистые)</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {supportLine.researchStrategy.totalTrades}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-600 mb-1">Всего дней</div>
                  <div className="text-xl font-bold text-gray-700">
                    {supportLine.researchStrategy.totalDays}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-600 mb-1">Закрыто по факту</div>
                  <div className={`text-xl font-bold ${supportLine.researchStrategy.hasFactClose ? 'text-orange-600' : 'text-green-600'}`}>
                    {supportLine.researchStrategy.hasFactClose}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-600 mb-1">Процент сделок</div>
                  <div className="text-xl font-bold text-purple-600">
                    {supportLine.researchStrategy.tradesPercent}%
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-600 mb-1">% для входа (×МН)</div>
                  <div className="text-lg font-bold text-blue-600">
                    +{supportLine.researchStrategy.entryPercent}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Стандартная стратегия (если нет разделения) */}
          {supportLine.tradingStrategy && !supportLine.testPeriodDays && (
            <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg border-2 border-emerald-300">
              <h4 className="font-semibold text-lg mb-3 text-emerald-900">🎯 Оптимальная торговая стратегия:</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-600 mb-1">Средний % в день</div>
                  <div className="text-2xl font-bold text-emerald-600">
                    {supportLine.tradingStrategy.avgPercentPerDay}%
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-600 mb-1">Трейды (чистые)</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {supportLine.tradingStrategy.totalTrades}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-600 mb-1">Всего дней</div>
                  <div className="text-xl font-bold text-gray-700">
                    {supportLine.tradingStrategy.totalDays}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-600 mb-1">Закрыто по факту</div>
                  <div className={`text-xl font-bold ${supportLine.tradingStrategy.hasFactClose ? 'text-orange-600' : 'text-green-600'}`}>
                    {supportLine.tradingStrategy.hasFactClose}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-600 mb-1">Процент сделок</div>
                  <div className="text-xl font-bold text-purple-600">
                    {supportLine.tradingStrategy.tradesPercent}%
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-600 mb-1">% для входа</div>
                  <div className="text-xl font-bold text-purple-600">
                    +{supportLine.tradingStrategy.entryPercent}%
                  </div>
                  <div className="text-xs text-gray-500 mt-1">от уровня поддержки</div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-600 mb-1">% для выхода</div>
                  <div className="text-xl font-bold text-orange-600">
                    +{supportLine.tradingStrategy.exitPercent}%
                  </div>
                  <div className="text-xs text-gray-500 mt-1">от уровня поддержки</div>
                </div>
              </div>
              <div className="mt-3 p-2 bg-white rounded text-sm text-gray-700">
                <strong>Общая прибыль:</strong> {supportLine.tradingStrategy.totalProfit}%
              </div>
            </div>
          )}

          <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
            <h4 className="font-semibold text-base mb-3 text-blue-900">📊 Точки экспоненциальной линии поддержки:</h4>
            <div className="space-y-3">
              {supportLine.points.map((point, idx) => {
                const candle = data[point.index];
                const date = new Date(candle.date);
                return (
                  <div key={idx} className="bg-white p-3 rounded-lg shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-blue-700">Точка {idx + 1}:</span>
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

          <div className="p-4 bg-green-50 rounded-lg">
            <h4 className="font-semibold text-sm mb-2 text-black">Характеристики экспоненциальной линии поддержки:</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Начальный уровень:</span>
                <span className="ml-2 font-medium text-black">${supportLine.startPrice.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-600">Конечный уровень:</span>
                <span className="ml-2 font-medium text-black">${supportLine.endPrice.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-600">Процент роста в день:</span>
                <span className="ml-2 font-medium text-blue-600">{supportLine.percentPerDayPercent}%</span>
              </div>
              <div>
                <span className="text-gray-600">Количество касаний:</span>
                <span className="ml-2 font-medium text-green-600">{supportLine.touches}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}