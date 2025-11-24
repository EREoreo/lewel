// Симуляция торговли для конкретной комбинации входа/выхода
function simulateTrading(data, curvePoints, entryPercent, exitPercent) {
  let totalProfit = 0;
  let cleanTrades = 0; // Чистые сделки (закрытые НЕ в последний день)
  let hasFactClose = false; // Есть ли сделка закрытая в последний день
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
          
          // Проверяем, это последний день или нет
          if (i === data.length - 1) {
            hasFactClose = true; // Закрыто в последний день
          } else {
            cleanTrades++; // Чистая сделка
          }
          
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
          hasFactClose = true; // Закрыто по факту в последний день
          inPosition = false;
        }
      }
      // Если купили в последний день, продаем в тот же день
      else if (i === buyDay && i === data.length - 1) {
        const sellPrice = candle.close;
        const profit = (sellPrice / buyPrice) * 100 - 100;
        totalProfit += profit;
        hasFactClose = true; // Закрыто по факту
        inPosition = false;
      }
    }
  }

  // Если остались в позиции после последнего дня
  if (inPosition) {
    const lastCandle = data[data.length - 1];
    const sellPrice = lastCandle.close;
    const profit = (sellPrice / buyPrice) * 100 - 100;
    totalProfit += profit;
    hasFactClose = true; // Закрыто по факту
  }

  // Считаем средний процент в день
  const avgPercentPerDay = totalProfit / data.length;

  return {
    avgPercentPerDay,
    cleanTrades, // НОВОЕ: только чистые трейды
    hasFactClose, // НОВОЕ: есть ли закрытие по факту
    totalProfit
  };
}

// Функция для оптимизации стратегии торговли на основе экспоненциальной линии поддержки
function optimizeLevel1TradingStrategy(data, curvePoints, minTradesPercent = 0) {
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
      
      if (result) {
        // НОВОЕ: Проверяем процент сделок
        const tradesPercent = (result.cleanTrades / data.length) * 100;
        
        // Пропускаем комбинацию если процент сделок меньше минимального
        if (tradesPercent < minTradesPercent) {
          continue;
        }
        
        // Проверяем, лучше ли эта комбинация
        if (result.avgPercentPerDay > maxAvgPercentPerDay) {
          maxAvgPercentPerDay = result.avgPercentPerDay;
          bestStrategy = {
            entryPercent: entryPercent.toFixed(1),
            exitPercent: exitPercent.toFixed(1),
            avgPercentPerDay: result.avgPercentPerDay.toFixed(4),
            totalTrades: result.cleanTrades, // ИЗМЕНЕНО: только чистые трейды
            totalDays: data.length,
            hasFactClose: result.hasFactClose ? 1 : 0,
            tradesPercent: tradesPercent.toFixed(2),
            totalProfit: result.totalProfit.toFixed(2)
          };
        }
      }
    }
  }

  return bestStrategy;
}

// ОСНОВНАЯ ФУНКЦИЯ - должна быть определена ПЕРВОЙ
export function calculateExponentialSupportLine(data, point1MaxDay = null, point2MinDay = null, minTradesPercent = 0) {
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
  
  // НОВОЕ: Проверка точки 1
  if (point1MaxDay !== null && absoluteMinIndex > point1MaxDay - 1) {
    console.log(`❌ Точка 1 на дне ${absoluteMinIndex + 1}, но должна быть до дня ${point1MaxDay}`);
    return null; // Не подходит, пропускаем
  }
  
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
    // НОВОЕ: Проверка точки 2 (от КОНЦА периода)
    if (point2MinDay !== null) {
      // point2MinDay = сколько дней от конца
      // Например: point2MinDay=3, всего 20 дней
      // Точка 2 должна быть в днях: 18, 19, 20 (последние 3 дня)
      const minAllowedIndex = data.length - point2MinDay; // 20 - 3 = 17 (индекс 17 = день 18)
      if (candidate.index < minAllowedIndex) {
        continue; // Пропускаем эту точку - она слишком рано
      }
    }
    
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
  if (!bestPoint2) {
    console.log(`❌ Точка 2 не найдена в последних ${point2MinDay || 'любых'} днях`);
    return null;
  }
  
  console.log(`✅ Точка 1: день ${point1.index + 1}, Точка 2: день ${bestPoint2.index + 1}`);
  
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
  
  // Оптимизируем стратегию торговли с учетом минимального процента сделок
  const tradingStrategy = optimizeLevel1TradingStrategy(data, curvePoints, minTradesPercent);
  
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

// Новая функция с разделением на тестируемый и исследуемый участок
export function calculateExponentialSupportLineWithTest(data, testPeriodDays, point1MaxDay = null, point2MinDay = null, minTradesPercent = 0) {
  if (!data || data.length < 2) return null;
  if (testPeriodDays >= data.length) {
    // Если тестовый период больше или равен всем данным, используем старую логику
    return calculateExponentialSupportLine(data, point1MaxDay, point2MinDay, minTradesPercent);
  }

  // Разделяем данные на два участка
  const testData = data.slice(0, testPeriodDays);

  console.log('\n🔬 РАЗДЕЛЕНИЕ НА УЧАСТКИ:');
  console.log(`Тестируемый участок: дни 1-${testPeriodDays} (${testPeriodDays} дней)`);
  console.log(`Исследуемый участок: дни ${testPeriodDays + 1}-${data.length} (${data.length - testPeriodDays} дней)`);

  // 1. Находим линию поддержки на тестируемом участке
  const testResult = calculateExponentialSupportLine(testData, point1MaxDay, point2MinDay, minTradesPercent);
  if (!testResult) return null;

  console.log('\n📊 ТЕСТИРУЕМЫЙ УЧАСТОК:');
  console.log(`Точка 1: день ${testResult.points[0].index + 1}, цена $${testResult.points[0].price.toFixed(2)}`);
  console.log(`Точка 2: день ${testResult.points[1].index + 1}, цена $${testResult.points[1].price.toFixed(2)}`);
  console.log(`Процент в день: ${testResult.percentPerDayPercent}%`);
  if (testResult.tradingStrategy) {
    console.log(`Стратегия: ENTER=${testResult.tradingStrategy.entryPercent}%, EXIT=${testResult.tradingStrategy.exitPercent}%`);
    console.log(`Средний % в день: ${testResult.tradingStrategy.avgPercentPerDay}%`);
    console.log(`Трейдов: ${testResult.tradingStrategy.totalTrades}, Процент сделок: ${testResult.tradingStrategy.tradesPercent}%`);
  }

  // 2. Продолжаем линию поддержки на исследуемый участок
  const fullCurvePoints = [];
  const basePrice = testResult.points[0].price;
  const baseIndex = testResult.points[0].index;
  const percentPerDay = testResult.percentPerDay;

  // Строим кривую для всего периода
  for (let i = 0; i < data.length; i++) {
    const price = basePrice * Math.pow(percentPerDay, i - baseIndex);
    fullCurvePoints.push({ index: i, price });
  }

  // 3. Проверяем пересечения в исследуемом участке
  let researchEndIndex = data.length - 1;
  let hasCrossing = false;
  
  for (let i = testPeriodDays; i < data.length; i++) {
    const curvePrice = fullCurvePoints[i].price;
    if (data[i].low < curvePrice - 0.001) {
      researchEndIndex = i - 1;
      hasCrossing = true;
      console.log(`\n⚠️ ПЕРЕСЕЧЕНИЕ в день ${i + 1}: цена $${data[i].low.toFixed(2)} < линия $${curvePrice.toFixed(2)}`);
      break;
    }
  }

  // 4. Применяем стратегию на исследуемом участке (до точки пересечения)
  const researchDataForCalc = data.slice(testPeriodDays, researchEndIndex + 1);
  const researchCurvePoints = fullCurvePoints.slice(testPeriodDays, researchEndIndex + 1).map((p, i) => ({
    index: i,
    price: p.price
  }));

  let researchStrategy = null;
  if (researchDataForCalc.length > 0 && testResult.tradingStrategy) {
    const entryPercent = parseFloat(testResult.tradingStrategy.entryPercent);
    const exitPercent = parseFloat(testResult.tradingStrategy.exitPercent);
    
    const result = simulateTrading(researchDataForCalc, researchCurvePoints, entryPercent, exitPercent);
    const tradesPercent = (result.cleanTrades / researchDataForCalc.length) * 100;
    
    researchStrategy = {
      avgPercentPerDay: result.avgPercentPerDay.toFixed(4),
      totalTrades: result.cleanTrades,
      totalDays: researchDataForCalc.length,
      hasFactClose: result.hasFactClose ? 1 : 0,
      tradesPercent: tradesPercent.toFixed(2),
      totalProfit: result.totalProfit.toFixed(2)
    };
  }

  console.log('\n📊 ИССЛЕДУЕМЫЙ УЧАСТОК:');
  console.log(`Действительный период: дни ${testPeriodDays + 1}-${researchEndIndex + 1} (${researchDataForCalc.length} дней)`);
  if (hasCrossing) {
    console.log(`⚠️ Линия пересекла свечу - расчеты до дня ${researchEndIndex + 1}`);
  }
  if (researchStrategy) {
    console.log(`Средний % в день: ${researchStrategy.avgPercentPerDay}%`);
    console.log(`Всего сделок: ${researchStrategy.totalTrades}`);
    console.log(`Общая прибыль: ${researchStrategy.totalProfit}%`);
    console.log(`Процент сделок: ${researchStrategy.tradesPercent}%`);
  }

  // 5. Рассчитываем процент похожести
  let similarityPercent = 0;
  if (testResult.tradingStrategy && researchStrategy) {
    const testAvg = parseFloat(testResult.tradingStrategy.avgPercentPerDay);
    const researchAvg = parseFloat(researchStrategy.avgPercentPerDay);
    
    if (testAvg !== 0) {
      similarityPercent = (researchAvg / testAvg) * 100;
    }
    
    console.log('\n🎯 ПРОЦЕНТ ПОХОЖЕСТИ:');
    console.log(`Тест: ${testAvg}% в день`);
    console.log(`Исследование: ${researchAvg}% в день`);
    console.log(`Похожесть: ${similarityPercent.toFixed(2)}%`);
  }

  return {
    points: testResult.points,
    curvePoints: fullCurvePoints,
    percentPerDay: percentPerDay,
    percentPerDayPercent: testResult.percentPerDayPercent,
    touches: testResult.touches,
    startPrice: fullCurvePoints[0].price,
    endPrice: fullCurvePoints[fullCurvePoints.length - 1].price,
    
    // Данные о разделении
    testPeriodDays: testPeriodDays,
    testStrategy: testResult.tradingStrategy,
    researchStrategy: researchStrategy,
    researchEndIndex: researchEndIndex,
    hasCrossing: hasCrossing,
    similarityPercent: similarityPercent.toFixed(2)
  };
}