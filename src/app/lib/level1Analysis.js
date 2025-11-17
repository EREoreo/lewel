// Функция для оптимизации стратегии торговли на основе экспоненциальной линии поддержки
function optimizeLevel1TradingStrategy(data, curvePoints) {
  if (!data || data.length < 2 || !curvePoints) return null;

  // Находим локальный максимум для определения предела выхода
  let localMax = 0;
  data.forEach(candle => {
    if (candle.high > localMax) {
      localMax = candle.high;
    }
  });

  let bestStrategy = null;
  let maxAvgPercentPerDay = -Infinity;

  // Перебираем все комбинации
  for (let entryPercent = 0.3; entryPercent <= 20.0; entryPercent += 0.1) {
    for (let exitPercent = entryPercent + 0.3; exitPercent <= 30.0; exitPercent += 0.1) {
      
      // Проверяем, достигает ли цена выхода локального максимума
      const maxSupportPrice = Math.max(...curvePoints.map(p => p.price));
      const exitPrice = maxSupportPrice * (1 + exitPercent / 100);
      
      // Если цена выхода не достигает локального максимума, прекращаем перебор для этого входа
      if (exitPrice > localMax) {
        break;
      }

      // Симулируем торговлю для этой комбинации
      const result = simulateTrading(data, curvePoints, entryPercent, exitPercent);
      
      if (result && result.avgPercentPerDay > maxAvgPercentPerDay) {
        maxAvgPercentPerDay = result.avgPercentPerDay;
        bestStrategy = {
          entryPercent: entryPercent.toFixed(1),
          exitPercent: exitPercent.toFixed(1),
          avgPercentPerDay: result.avgPercentPerDay.toFixed(4),
          totalTrades: result.totalTrades,
          totalProfit: result.totalProfit.toFixed(2)
        };
      }
    }
  }

  return bestStrategy;
}

// Симуляция торговли для конкретной комбинации входа/выхода
function simulateTrading(data, curvePoints, entryPercent, exitPercent) {
  let totalProfit = 0;
  let totalTrades = 0;
  let inPosition = false;
  let buyPrice = 0;
  let buyDay = -1;

  for (let i = 0; i < data.length; i++) {
    const candle = data[i];
    const supportPrice = curvePoints[i].price;
    const entryPrice = supportPrice * (1 + entryPercent / 100);
    const exitPriceTarget = supportPrice * (1 + exitPercent / 100);

    // Если не в позиции, проверяем условие покупки
    if (!inPosition) {
      // Покупаем если Low <= entryPrice
      if (candle.low <= entryPrice) {
        inPosition = true;
        buyPrice = entryPrice;
        buyDay = i;
        totalTrades++;
      }
    } 
    // Если в позиции, проверяем условие продажи
    else {
      // Не можем продать в день покупки
      if (i > buyDay) {
        // Проверяем, можем ли продать (High >= exitPriceTarget)
        if (candle.high >= exitPriceTarget) {
          // Продаем
          const sellPrice = exitPriceTarget;
          const profit = (sellPrice / buyPrice) * 100 - 100;
          totalProfit += profit;
          inPosition = false;
          buyPrice = 0;
          buyDay = -1;
        }
        // Если это последний день и мы все еще в позиции
        else if (i === data.length - 1) {
          // Продаем по цене закрытия
          const sellPrice = candle.close;
          const profit = (sellPrice / buyPrice) * 100 - 100;
          totalProfit += profit;
          inPosition = false;
        }
      }
      // Если купили в последний день, продаем в тот же день
      else if (i === buyDay && i === data.length - 1) {
        const sellPrice = candle.close;
        const profit = (sellPrice / buyPrice) * 100 - 100;
        totalProfit += profit;
        inPosition = false;
      }
    }
  }

  // Если остались в позиции после последнего дня (не должно случиться, но на всякий случай)
  if (inPosition) {
    const lastCandle = data[data.length - 1];
    const sellPrice = lastCandle.close;
    const profit = (sellPrice / buyPrice) * 100 - 100;
    totalProfit += profit;
  }

  // Считаем средний процент в день
  const avgPercentPerDay = totalProfit / data.length;

  return {
    avgPercentPerDay,
    totalTrades,
    totalProfit
  };
}

export function calculateExponentialSupportLine(data) {
  if (!data || data.length < 2) return null;
  
  // 1. Находим абсолютный минимум (первая точка)
  let absoluteMinIndex = 0;
  let absoluteMinPrice = data[0].low;
  
  data.forEach((candle, i) => {
    if (candle.low < absoluteMinPrice) {
      absoluteMinPrice = candle.low;
      absoluteMinIndex = i;
    }
  });
  
  const point1 = {
    index: absoluteMinIndex,
    price: absoluteMinPrice,
    date: data[absoluteMinIndex].date
  };
  
  // 2. Ищем все возможные точки справа от первой
  const candidatesRight = [];
  for (let i = absoluteMinIndex + 1; i < data.length; i++) {
    candidatesRight.push({
      index: i,
      price: data[i].low,
      date: data[i].date
    });
  }
  
  // Если справа нет точек, возвращаем null
  if (candidatesRight.length === 0) return null;
  
  // 3. Перебираем все точки и ищем ту, при которой процент минимальный
  let minPercentPerDay = Infinity;
  let bestPoint2 = null;
  let bestCurveParams = null;
  
  for (const candidate of candidatesRight) {
    const n = candidate.index - point1.index; // количество дней между точками
    
    // Рассчитываем процент в день: n√(цена2 / цена1)
    const percentPerDay = Math.pow(candidate.price / point1.price, 1 / n);
    
    // Строим кривую и проверяем, что все свечи выше неё
    let isValid = true;
    
    for (let i = 0; i < data.length; i++) {
      // Цена на кривой для дня i: цена1 × (percentPerDay)^(i - день1)
      const curvePrice = point1.price * Math.pow(percentPerDay, i - point1.index);
      
      // Проверяем, что свеча выше кривой (с небольшим допуском)
      if (data[i].low < curvePrice - 0.001) {
        isValid = false;
        break;
      }
    }
    
    // Если кривая валидна и процент меньше минимального
    if (isValid && percentPerDay < minPercentPerDay) {
      minPercentPerDay = percentPerDay;
      bestPoint2 = candidate;
      bestCurveParams = {
        basePrice: point1.price,
        baseIndex: point1.index,
        percentPerDay: percentPerDay
      };
    }
  }
  
  // Если не нашли подходящую точку
  if (!bestPoint2) return null;
  
  // Формируем массив точек кривой для отрисовки
  const curvePoints = [];
  for (let i = 0; i < data.length; i++) {
    const price = bestCurveParams.basePrice * Math.pow(
      bestCurveParams.percentPerDay,
      i - bestCurveParams.baseIndex
    );
    curvePoints.push({ index: i, price });
  }
  
  // Считаем касания (свечи, которые близко к кривой)
  let touches = 0;
  data.forEach((candle, i) => {
    const curvePrice = curvePoints[i].price;
    const diff = Math.abs(candle.low - curvePrice);
    if (diff < 0.5) { // если разница меньше 50 центов
      touches++;
    }
  });
  
  // Оптимизируем стратегию торговли
  const tradingStrategy = optimizeLevel1TradingStrategy(data, curvePoints);
  
  return {
    points: [point1, bestPoint2],
    curvePoints: curvePoints,
    percentPerDay: bestCurveParams.percentPerDay,
    percentPerDayPercent: ((bestCurveParams.percentPerDay - 1) * 100).toFixed(4), // в процентах
    touches: Math.max(touches, 2),
    startPrice: curvePoints[0].price,
    endPrice: curvePoints[curvePoints.length - 1].price,
    tradingStrategy: tradingStrategy // Добавляем оптимальную стратегию
  };
}