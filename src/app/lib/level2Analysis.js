// Функция для оптимизации стратегии торговли на основе экспоненциальной линии сопротивления
function optimizeLevel2TradingStrategy(data, curvePoints) {
  if (!data || data.length < 2 || !curvePoints) return null;

  // Находим локальный минимум для определения предела выхода
  let localMin = Infinity;
  data.forEach(candle => {
    if (candle.low < localMin) {
      localMin = candle.low;
    }
  });

  let bestStrategy = null;
  let maxAvgPercentPerDay = -Infinity;

  // Перебираем все комбинации (для шорта - обратная логика)
  for (let entryPercent = 0.3; entryPercent <= 10.0; entryPercent += 0.1) {
    for (let exitPercent = entryPercent + 0.3; exitPercent <= 20.0; exitPercent += 0.1) {
      
      // Проверяем, достигает ли цена выхода локального минимума
      const minResistancePrice = Math.min(...curvePoints.map(p => p.price));
      const exitPrice = minResistancePrice * (1 - exitPercent / 100);
      
      // Если цена выхода не достигает локального минимума, прекращаем перебор для этого входа
      if (exitPrice < localMin) {
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

// Симуляция торговли для конкретной комбинации входа/выхода (SHORT)
function simulateTrading(data, curvePoints, entryPercent, exitPercent) {
  let totalProfit = 0;
  let totalTrades = 0;
  let inPosition = false;
  let sellPrice = 0;
  let sellDay = -1;

  for (let i = 0; i < data.length; i++) {
    const candle = data[i];
    const resistancePrice = curvePoints[i].price;
    const entryPrice = resistancePrice * (1 - entryPercent / 100); // Продаем ниже сопротивления
    const exitPriceTarget = resistancePrice * (1 - exitPercent / 100); // Выкупаем еще ниже

    // Если не в позиции, проверяем условие продажи (SHORT)
    if (!inPosition) {
      // ПРОДАЕМ (открываем SHORT) если High >= entryPrice
      if (candle.high >= entryPrice) {
        inPosition = true;
        sellPrice = entryPrice;
        sellDay = i;
        totalTrades++;
      }
    } 
    // Если в позиции, проверяем условие выкупа
    else {
      // Не можем выкупить в день продажи
      if (i > sellDay) {
        // Проверяем, можем ли выкупить (Low <= exitPriceTarget)
        if (candle.low <= exitPriceTarget) {
          // Выкупаем
          const buyPrice = exitPriceTarget;
          const profit = (sellPrice - buyPrice) / sellPrice * 100; // Прибыль от шорта
          totalProfit += profit;
          inPosition = false;
          sellPrice = 0;
          sellDay = -1;
        }
        // Если это последний день и мы все еще в позиции
        else if (i === data.length - 1) {
          // Выкупаем по цене закрытия
          const buyPrice = candle.close;
          const profit = (sellPrice - buyPrice) / sellPrice * 100;
          totalProfit += profit;
          inPosition = false;
        }
      }
      // Если продали в последний день, выкупаем в тот же день
      else if (i === sellDay && i === data.length - 1) {
        const buyPrice = candle.close;
        const profit = (sellPrice - buyPrice) / sellPrice * 100;
        totalProfit += profit;
        inPosition = false;
      }
    }
  }

  // Если остались в позиции после последнего дня
  if (inPosition) {
    const lastCandle = data[data.length - 1];
    const buyPrice = lastCandle.close;
    const profit = (sellPrice - buyPrice) / sellPrice * 100;
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

export function calculateExponentialResistanceLine(data) {
  if (!data || data.length < 2) return null;
  
  // 1. Находим абсолютный максимум (первая точка)
  let absoluteMaxIndex = 0;
  let absoluteMaxPrice = data[0].high;
  
  data.forEach((candle, i) => {
    if (candle.high > absoluteMaxPrice) {
      absoluteMaxPrice = candle.high;
      absoluteMaxIndex = i;
    }
  });
  
  const point1 = {
    index: absoluteMaxIndex,
    price: absoluteMaxPrice,
    date: data[absoluteMaxIndex].date
  };
  
  // 2. Ищем все возможные точки справа от первой
  const candidatesRight = [];
  for (let i = absoluteMaxIndex + 1; i < data.length; i++) {
    candidatesRight.push({
      index: i,
      price: data[i].high,
      date: data[i].date
    });
  }
  
  // Если справа нет точек, возвращаем null
  if (candidatesRight.length === 0) return null;
  
  // 3. Перебираем все точки и ищем ту, при которой процент минимальный (наибольшее падение)
  let minPercentPerDay = Infinity;
  let bestPoint2 = null;
  let bestCurveParams = null;
  
  for (const candidate of candidatesRight) {
    const n = candidate.index - point1.index; // количество дней между точками
    
    // Рассчитываем процент в день: n√(цена2 / цена1)
    const percentPerDay = Math.pow(candidate.price / point1.price, 1 / n);
    
    // Строим кривую и проверяем, что все свечи ниже неё
    let isValid = true;
    
    for (let i = 0; i < data.length; i++) {
      // Цена на кривой для дня i: цена1 × (percentPerDay)^(i - день1)
      const curvePrice = point1.price * Math.pow(percentPerDay, i - point1.index);
      
      // Проверяем, что свеча ниже кривой (с небольшим допуском)
      if (data[i].high > curvePrice + 0.001) {
        isValid = false;
        break;
      }
    }
    
    // Если кривая валидна и процент меньше минимального (больше падение)
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
    const diff = Math.abs(candle.high - curvePrice);
    if (diff < 0.5) { // если разница меньше 50 центов
      touches++;
    }
  });
  
  // Оптимизируем стратегию торговли (SHORT)
  const tradingStrategy = optimizeLevel2TradingStrategy(data, curvePoints);
  
  return {
    points: [point1, bestPoint2],
    curvePoints: curvePoints,
    percentPerDay: bestCurveParams.percentPerDay,
    percentPerDayPercent: ((bestCurveParams.percentPerDay - 1) * 100).toFixed(4), // в процентах (будет отрицательным)
    touches: Math.max(touches, 2),
    startPrice: curvePoints[0].price,
    endPrice: curvePoints[curvePoints.length - 1].price,
    tradingStrategy: tradingStrategy // Добавляем оптимальную стратегию
  };
}