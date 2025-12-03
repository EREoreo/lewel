'use client';

import { useEffect, useRef, useState } from 'react';
import { calculateExponentialResistanceLine, calculateExponentialResistanceLineWithTest } from '../lib/level2Analysis';
import * as XLSX from 'xlsx';

export default function Level2Chart({ data, ticker, testPeriodDays = null, point1MaxDay = null, point2MinDay = null, minTradesPercent = 0 }) {
  const canvasRef = useRef(null);
  const [resistanceLine, setResistanceLine] = useState(null);
  const [hoveredCandle, setHoveredCandle] = useState(null);

  const downloadExcel = () => {
    if (!resistanceLine || !ticker) return;

    const point1 = resistanceLine.points[0];
    const point2 = resistanceLine.points[1];
    const strategy = resistanceLine.testStrategy || resistanceLine.tradingStrategy;

    let excelData;
    if (resistanceLine.testPeriodDays) {
      // Режим с разделением на участки - РАСШИРЕННЫЙ ФОРМАТ
      excelData = [
        ['Тикер', ticker],
        ['', ''],
        ['📊 ПАРАМЕТРЫ ЛИНИИ'],
        ['Точка 1 (день)', point1.index + 1],
        ['Точка 1 (цена)', parseFloat(point1.price.toFixed(2))],
        ['Точка 2 (день)', point2.index + 1],
        ['Точка 2 (цена)', parseFloat(point2.price.toFixed(2))],
        ['Процент в день', parseFloat(resistanceLine.percentPerDayPercent)],
        ['', ''],
        ['🔬 ТЕСТИРУЕМЫЙ УЧАСТОК (дни 1-' + resistanceLine.testPeriodDays + ')'],
        ['Средний % в день', parseFloat(strategy?.avgPercentPerDay || 0)],
        ['% для входа (SHORT)', parseFloat(strategy?.entryPercent || 0)],
        ['% для выхода', parseFloat(strategy?.exitPercent || 0)],
        ['Трейды (чистые)', strategy?.totalTrades || 0],
        ['Всего дней', strategy?.totalDays || 0],
        ['Закрыто по факту', strategy?.hasFactClose || 0],
        ['Процент сделок', parseFloat(strategy?.tradesPercent || 0)],
        ['Общая прибыль', parseFloat(strategy?.totalProfit || 0)],
        ['', ''],
        ['🧪 ИССЛЕДУЕМЫЙ УЧАСТОК (дни ' + (resistanceLine.testPeriodDays + 1) + '-' + (resistanceLine.researchEndIndex + 1) + ')'],
        ['Средний % в день', parseFloat(resistanceLine.researchStrategy?.avgPercentPerDay || 0)],
        ['Трейды (чистые)', resistanceLine.researchStrategy?.totalTrades || 0],
        ['Всего дней', resistanceLine.researchStrategy?.totalDays || 0],
        ['Закрыто по факту', resistanceLine.researchStrategy?.hasFactClose || 0],
        ['Процент сделок', parseFloat(resistanceLine.researchStrategy?.tradesPercent || 0)],
        ['Общая прибыль', parseFloat(resistanceLine.researchStrategy?.totalProfit || 0)],
        ['', ''],
        ['⚠️ ПЕРЕСЕЧЕНИЕ', resistanceLine.hasCrossing ? 'Да' : 'Нет'],
        ['', ''],
        ['🎯 ПРОЦЕНТ ПОХОЖЕСТИ', parseFloat(resistanceLine.similarityPercent || 0)],
        ['', ''],
        ['📝 ФОРМУЛА СХОЖЕСТИ'],
        ['(Иссл ср% в день / Тест ср% в день) × 100']
      ];
    } else {
      // Обычный режим - с заголовками (БЕЗ ЗНАКОВ %)
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
          '% для входа (SHORT)',
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
          parseFloat(resistanceLine.percentPerDayPercent),
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
    XLSX.utils.book_append_sheet(wb, ws, 'Level2 Resistance');
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

    // Сетка
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

    // Рассчитываем линию с фильтрами
    let resistance;
    if (testPeriodDays && testPeriodDays < data.length) {
      resistance = calculateExponentialResistanceLineWithTest(data, testPeriodDays, point1MaxDay, point2MinDay, minTradesPercent);
    } else {
      resistance = calculateExponentialResistanceLine(data, point1MaxDay, point2MinDay, minTradesPercent);
    }
    setResistanceLine(resistance);

    // Рисуем красную разделительную линию
    if (resistance && resistance.testPeriodDays) {
      const dividerX = indexToX(resistance.testPeriodDays);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(dividerX, padding);
      ctx.lineTo(dividerX, canvas.height - padding);
      ctx.stroke();
      ctx.setLineDash([]);
      
      ctx.fillStyle = '#3b82f6';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🔬 тестируемый', dividerX / 2 + padding / 2, padding - 10);
      
      ctx.fillStyle = '#10b981';
      ctx.fillText('🧪 исследуемый', dividerX + (canvas.width - padding - dividerX) / 2, padding - 10);
    }

    // Рисуем кривую
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
      
      // Если есть пересечение
      if (resistance.hasCrossing && resistance.researchEndIndex < data.length - 1) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        
        for (let i = resistance.researchEndIndex + 1; i < resistance.curvePoints.length; i++) {
          const point = resistance.curvePoints[i];
          const x = indexToX(point.index);
          const y = priceToY(point.price);
          
          if (i === resistance.researchEndIndex + 1) {
            const prevPoint = resistance.curvePoints[i - 1];
            ctx.moveTo(indexToX(prevPoint.index), priceToY(prevPoint.price));
          }
          ctx.lineTo(x, y);
        }
        
        ctx.stroke();
        ctx.setLineDash([]);
      }
      
      ctx.fillStyle = '#dc2626';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Resistance (Exponential)', canvas.width - padding + 10, priceToY(resistance.endPrice) + 4);
    }

    // Свечи
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
  }, [data, testPeriodDays, point1MaxDay, point2MinDay, minTradesPercent]);

  // Функции для цвета и эмодзи схожести (аналогично Level1)
  const getSimilarityColor = (percent) => {
    const value = parseFloat(percent);
    if (value >= 90 && value <= 110) return 'text-green-600';
    if (value >= 70 && value < 90) return 'text-yellow-600';
    if (value > 110 && value <= 130) return 'text-blue-600';
    return 'text-red-600';
  };

  const getSimilarityEmoji = (percent) => {
    const value = parseFloat(percent);
    if (value >= 95 && value <= 105) return '🎯';
    if (value >= 90 && value <= 110) return '✅';
    if (value >= 70 && value < 90) return '⚠️';
    if (value > 110 && value <= 130) return '🚀';
    return '❌';
  };

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

          {/* Процент похожести - ГЛАВНЫЙ БЛОК */}
          {resistanceLine.testPeriodDays && resistanceLine.similarityPercent && (
            <div className="p-6 bg-gradient-to-br from-orange-50 via-red-50 to-orange-100 rounded-xl border-3 border-orange-400 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xl font-bold text-orange-900">
                  {getSimilarityEmoji(resistanceLine.similarityPercent)} Процент схожести
                </h4>
                <div className="text-xs text-orange-700 bg-white px-3 py-1 rounded-full">
                  Иссл / Тест × 100
                </div>
              </div>
              <div className={`text-6xl font-black text-center py-4 ${getSimilarityColor(resistanceLine.similarityPercent)}`}>
                {resistanceLine.similarityPercent}%
              </div>
              <div className="mt-3 text-center text-sm text-orange-800">
                <div className="flex justify-center gap-4 mt-2">
                  <div className="bg-white px-3 py-1 rounded-lg">
                    <span className="text-xs text-gray-600">Тест:</span>
                    <span className="ml-1 font-semibold">{resistanceLine.testStrategy?.avgPercentPerDay}%</span>
                  </div>
                  <div className="text-2xl text-orange-600">→</div>
                  <div className="bg-white px-3 py-1 rounded-lg">
                    <span className="text-xs text-gray-600">Иссл:</span>
                    <span className="ml-1 font-semibold">{resistanceLine.researchStrategy?.avgPercentPerDay}%</span>
                  </div>
                </div>
              </div>
              {/* Интерпретация */}
              <div className="mt-4 p-3 bg-white rounded-lg text-center">
                <div className="text-xs font-semibold text-gray-700 mb-1">Интерпретация:</div>
                {parseFloat(resistanceLine.similarityPercent) >= 95 && parseFloat(resistanceLine.similarityPercent) <= 105 && (
                  <div className="text-sm text-green-700">🎯 Идеальная стабильность!</div>
                )}
                {parseFloat(resistanceLine.similarityPercent) >= 90 && parseFloat(resistanceLine.similarityPercent) < 95 && (
                  <div className="text-sm text-green-600">✅ Отличная стабильность</div>
                )}
                {parseFloat(resistanceLine.similarityPercent) > 105 && parseFloat(resistanceLine.similarityPercent) <= 110 && (
                  <div className="text-sm text-green-600">✅ Отличная стабильность</div>
                )}
                {parseFloat(resistanceLine.similarityPercent) > 110 && parseFloat(resistanceLine.similarityPercent) <= 130 && (
                  <div className="text-sm text-blue-600">🚀 Исследование лучше теста</div>
                )}
                {parseFloat(resistanceLine.similarityPercent) >= 70 && parseFloat(resistanceLine.similarityPercent) < 90 && (
                  <div className="text-sm text-yellow-600">⚠️ Приемлемая стабильность</div>
                )}
                {parseFloat(resistanceLine.similarityPercent) < 70 && (
                  <div className="text-sm text-red-600">❌ Слабая стабильность</div>
                )}
                {parseFloat(resistanceLine.similarityPercent) > 130 && (
                  <div className="text-sm text-orange-600">⚠️ Возможна аномалия</div>
                )}
              </div>
            </div>
          )}

          {/* Блок с тестовым периодом */}
          {resistanceLine.testPeriodDays && resistanceLine.testStrategy && (
            <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border-2 border-blue-300">
              <h4 className="font-semibold text-lg mb-3 text-blue-900">🔬 Тестируемый период (дни 1-{resistanceLine.testPeriodDays}):</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-600 mb-1">Трейды (чистые)</div>
                  <div className="text-xl font-bold text-blue-600">
                    {resistanceLine.testStrategy.totalTrades}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-600 mb-1">Всего дней</div>
                  <div className="text-xl font-bold text-gray-700">
                    {resistanceLine.testStrategy.totalDays}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-600 mb-1">Закрыто по факту</div>
                  <div className={`text-xl font-bold ${resistanceLine.testStrategy.hasFactClose ? 'text-orange-600' : 'text-green-600'}`}>
                    {resistanceLine.testStrategy.hasFactClose}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-600 mb-1">Процент сделок</div>
                  <div className="text-xl font-bold text-purple-600">
                    {resistanceLine.testStrategy.tradesPercent}%
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-600 mb-1">% для входа (SHORT)</div>
                  <div className="text-xl font-bold text-red-600">
                    -{resistanceLine.testStrategy.entryPercent}%
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-600 mb-1">Средний % в день</div>
                  <div className="text-xl font-bold text-green-600">
                    {resistanceLine.testStrategy.avgPercentPerDay}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Блок с исследуемым периодом */}
          {resistanceLine.testPeriodDays && resistanceLine.researchStrategy && (
            <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-2 border-green-300">
              <h4 className="font-semibold text-lg mb-3 text-green-900">
                🧪 Исследуемый период (дни {resistanceLine.testPeriodDays + 1}-{resistanceLine.researchEndIndex + 1}):
                {resistanceLine.hasCrossing && <span className="ml-2 text-orange-600">⚠️ Есть пересечение</span>}
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-600 mb-1">Трейды (чистые)</div>
                  <div className="text-xl font-bold text-blue-600">
                    {resistanceLine.researchStrategy.totalTrades}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-600 mb-1">Всего дней</div>
                  <div className="text-xl font-bold text-gray-700">
                    {resistanceLine.researchStrategy.totalDays}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-600 mb-1">Закрыто по факту</div>
                  <div className={`text-xl font-bold ${resistanceLine.researchStrategy.hasFactClose ? 'text-orange-600' : 'text-green-600'}`}>
                    {resistanceLine.researchStrategy.hasFactClose}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-600 mb-1">Процент сделок</div>
                  <div className="text-xl font-bold text-purple-600">
                    {resistanceLine.researchStrategy.tradesPercent}%
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-600 mb-1">Общая прибыль</div>
                  <div className="text-xl font-bold text-green-600">
                    {resistanceLine.researchStrategy.totalProfit}%
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-600 mb-1">Средний % в день</div>
                  <div className="text-xl font-bold text-green-600">
                    {resistanceLine.researchStrategy.avgPercentPerDay}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Стандартная стратегия (если нет разделения) */}
          {resistanceLine.tradingStrategy && !resistanceLine.testPeriodDays && (
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
                  <div className="text-xs text-gray-600 mb-1">Трейды (чистые)</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {resistanceLine.tradingStrategy.totalTrades}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-600 mb-1">Всего дней</div>
                  <div className="text-xl font-bold text-gray-700">
                    {resistanceLine.tradingStrategy.totalDays}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-600 mb-1">Закрыто по факту</div>
                  <div className={`text-xl font-bold ${resistanceLine.tradingStrategy.hasFactClose ? 'text-orange-600' : 'text-green-600'}`}>
                    {resistanceLine.tradingStrategy.hasFactClose}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="text-xs text-gray-600 mb-1">Процент сделок</div>
                  <div className="text-xl font-bold text-purple-600">
                    {resistanceLine.tradingStrategy.tradesPercent}%
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