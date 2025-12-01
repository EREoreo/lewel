// Симуляция торговли для конкретной комбинации входа/выхода
function simulateTrading(data, curvePoints, entryPercent, exitPercent) {
  let totalProfit = 0;
  let cleanTrades = 0; // Чистые сделки (закрытые НЕ в последний день)
  let hasFactClose = 0; // Есть ли сделка закрытая по факту
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
      const isLastDay = (i === data.length - 1);
      
      // КРИТИЧНО: Не продаем в день покупки (кроме случая когда покупка в последний день)
      if (i === buyDay && !isLastDay) {
        continue; // Пропускаем этот день
      }
      
      // Проверяем нормальный выход (High >= exitPriceTarget)
      const normalExit = candle.high >= exitPriceTarget;
      
      if (normalExit) {
        // ✅ НОРМАЛЬНЫЙ ВЫХОД - продаем по целевой цене
        const sellPrice = exitPriceTarget;
        const profit = (sellPrice / buyPrice) * 100 - 100;
        totalProfit += profit;
        
        if (isLastDay) {
          // Вышли нормально, но в последний день - это НЕ "по факту"
          cleanTrades++;
        } else {
          // Вышли нормально до последнего дня
          cleanTrades++;
        }
        
        inPosition = false;
        buyPrice = 0;
        buyDay = -1;
      }
      else if (isLastDay) {
        // ⚠️ ВЫХОД ПО ФАКТУ - не достигли цели, продаем по close
        const sellPrice = candle.close;
        const profit = (sellPrice / buyPrice) * 100 - 100;
        totalProfit += profit;
        hasFactClose = 1; // Закрытие по факту
        
        inPosition = false;
        buyPrice = 0;
        buyDay = -1;
      }
    }
  }

  // Считаем средний процент в день
  const avgPercentPerDay = totalProfit / data.length;

  return {
    avgPercentPerDay,
    cleanTrades, // Только чистые трейды
    hasFactClose, // 0 или 1
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
            hasFactClose: result.hasFactClose,
            tradesPercent: tradesPercent.toFixed(2),
            totalProfit: result.totalProfit.toFixed(2)
          };
        }
      }
    }
  }

  return bestStrategy;
}

// ОСНОВНАЯ ФУНКЦИЯ - для одиночной обработки БЕЗ тестового периода
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
  
  // НОВОЕ: Если стратегия не найдена (не прошел фильтр % сделок) - возвращаем null
  if (!tradingStrategy && minTradesPercent > 0) {
    console.log(`❌ Не найдена стратегия с процентом сделок >= ${minTradesPercent}%`);
    return null;
  }
  
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

// НОВАЯ функция с полным перебором комбинаций и выбором лучшей по схожести
export function calculateExponentialSupportLineWithTest(data, testPeriodDays, point1MaxDay = null, point2MinDay = null, minTradesPercent = 0) {
  if (!data || data.length < 2) return null;
  if (testPeriodDays >= data.length) {
    return calculateExponentialSupportLine(data, point1MaxDay, point2MinDay, minTradesPercent);
  }

  console.log('\n🔬 НАЧАЛО ПОИСКА ЛУЧШЕЙ КОМБИНАЦИИ (LEVEL 1)');
  console.log(`Тестовый участок: дни 1-${testPeriodDays}`);
  console.log(`Исследуемый участок: дни ${testPeriodDays + 1}-${data.length}`);
  console.log(`Фильтры: точка1≤${point1MaxDay || 'любой'}, точка2≥${point2MinDay || 'любой'}, %сделок≥${minTradesPercent}%`);

  const testData = data.slice(0, testPeriodDays);

  // 1. НАХОДИМ ВСЕ ВОЗМОЖНЫЕ КОМБИНАЦИИ ТОЧЕК НА ТЕСТОВОМ УЧАСТКЕ
  const allCombinations = [];
  
  // Находим все точки-кандидаты на тестовом участке
  for (let i = 0; i < testData.length; i++) {
    // Проверка фильтра для точки 1
    if (point1MaxDay !== null && i > point1MaxDay - 1) continue;
    
    for (let j = i + 1; j < testData.length; j++) {
      // Проверка фильтра для точки 2
      if (point2MinDay !== null) {
        const minAllowedIndex = testData.length - point2MinDay;
        if (j < minAllowedIndex) continue;
      }
      
      // Рассчитываем экспоненциальную линию для этой пары точек
      const n = j - i;
      const percentPerDay = Math.pow(testData[j].low / testData[i].low, 1 / n);
      
      // Проверяем, что линия проходит ниже всех свечей на тестовом участке
      let isValid = true;
      for (let k = 0; k < testData.length; k++) {
        const curvePrice = testData[i].low * Math.pow(percentPerDay, k - i);
        if (testData[k].low < curvePrice - 0.001) {
          isValid = false;
          break;
        }
      }
      
      if (!isValid) continue;
      
      // Строим кривую для тестового участка
      const testCurvePoints = [];
      for (let k = 0; k < testData.length; k++) {
        const price = testData[i].low * Math.pow(percentPerDay, k - i);
        testCurvePoints.push({ index: k, price });
      }
      
      allCombinations.push({
        point1Index: i,
        point2Index: j,
        point1Price: testData[i].low,
        point2Price: testData[j].low,
        percentPerDay: percentPerDay,
        testCurvePoints: testCurvePoints
      });
    }
  }
  
  console.log(`\n📋 Найдено комбинаций точек: ${allCombinations.length}`);
  
  if (allCombinations.length === 0) {
    console.log('❌ Нет комбинаций, прошедших фильтры точек');
    return null;
  }

  // 2. ПЕРЕБИРАЕМ ВСЕ СТРАТЕГИИ ДЛЯ КАЖДОЙ КОМБИНАЦИИ
  let bestCombination = null;
  let maxSimilarity = -Infinity;
  let totalChecked = 0;
  let passedFilters = 0;

  for (const combo of allCombinations) {
    // Находим локальный максимум для этой комбинации
    let localMax = 0;
    testData.forEach(candle => {
      if (candle.high > localMax) localMax = candle.high;
    });

    // Перебираем стратегии
    for (let entryPercent = 0.3; entryPercent <= 20.0; entryPercent += 0.1) {
      for (let exitPercent = entryPercent + 0.3; exitPercent <= 30.0; exitPercent += 0.1) {
        totalChecked++;
        
        // Проверяем достижимость цены выхода
        const maxSupportPrice = Math.max(...combo.testCurvePoints.map(p => p.price));
        const exitPrice = maxSupportPrice * (1 + exitPercent / 100);
        if (exitPrice > localMax) break;

        // ТЕСТ: Симулируем торговлю на тестовом участке
        const testResult = simulateTrading(testData, combo.testCurvePoints, entryPercent, exitPercent);
        const testTradesPercent = (testResult.cleanTrades / testData.length) * 100;
        
        // ФИЛЬТР 3: Проверяем минимальный % сделок на тестовом участке
        if (testTradesPercent < minTradesPercent) continue;

        // ИССЛЕДОВАНИЕ: Продлеваем линию и симулируем на исследуемом участке
        const fullCurvePoints = [];
        for (let k = 0; k < data.length; k++) {
          const price = combo.point1Price * Math.pow(combo.percentPerDay, k - combo.point1Index);
          fullCurvePoints.push({ index: k, price });
        }

        // Проверяем пересечения
        let researchEndIndex = data.length - 1;
        let hasCrossing = false;
        for (let k = testPeriodDays; k < data.length; k++) {
          if (data[k].low < fullCurvePoints[k].price - 0.001) {
            researchEndIndex = k - 1;
            hasCrossing = true;
            break;
          }
        }

        const researchDataForCalc = data.slice(testPeriodDays, researchEndIndex + 1);
        if (researchDataForCalc.length === 0) continue;

        const researchCurvePoints = fullCurvePoints.slice(testPeriodDays, researchEndIndex + 1).map((p, idx) => ({
          index: idx,
          price: p.price
        }));

        const researchResult = simulateTrading(researchDataForCalc, researchCurvePoints, entryPercent, exitPercent);
        const researchTradesPercent = (researchResult.cleanTrades / researchDataForCalc.length) * 100;

        // ФИЛЬТР: Проверяем минимальный % сделок на исследуемом участке
        if (researchTradesPercent < minTradesPercent) continue;

        passedFilters++;

        // РАСЧЕТ СХОЖЕСТИ
        const testAvg = testResult.avgPercentPerDay;
        const researchAvg = researchResult.avgPercentPerDay;
        const similarity = testAvg !== 0 ? (researchAvg / testAvg) * 100 : 0;

        // Сохраняем лучшую комбинацию
        if (similarity > maxSimilarity) {
          maxSimilarity = similarity;
          bestCombination = {
            ...combo,
            entryPercent: entryPercent.toFixed(1),
            exitPercent: exitPercent.toFixed(1),
            testStrategy: {
              avgPercentPerDay: testResult.avgPercentPerDay.toFixed(4),
              totalTrades: testResult.cleanTrades,
              totalDays: testData.length,
              hasFactClose: testResult.hasFactClose,
              tradesPercent: testTradesPercent.toFixed(2),
              totalProfit: testResult.totalProfit.toFixed(2),
              entryPercent: entryPercent.toFixed(1),
              exitPercent: exitPercent.toFixed(1)
            },
            researchStrategy: {
              avgPercentPerDay: researchResult.avgPercentPerDay.toFixed(4),
              totalTrades: researchResult.cleanTrades,
              totalDays: researchDataForCalc.length,
              hasFactClose: researchResult.hasFactClose,
              tradesPercent: researchTradesPercent.toFixed(2),
              totalProfit: researchResult.totalProfit.toFixed(2)
            },
            fullCurvePoints: fullCurvePoints,
            researchEndIndex: researchEndIndex,
            hasCrossing: hasCrossing,
            similarityPercent: similarity.toFixed(2)
          };
        }
      }
    }
  }

  console.log(`\n📊 СТАТИСТИКА:`);
  console.log(`Проверено комбинаций: ${totalChecked}`);
  console.log(`Прошло все фильтры: ${passedFilters}`);
  
  if (!bestCombination) {
    console.log('❌ Ни одна комбинация не прошла все фильтры');
    return null;
  }

  console.log(`\n🏆 ЛУЧШАЯ КОМБИНАЦИЯ (схожесть: ${bestCombination.similarityPercent}%):`);
  console.log(`Точка 1: день ${bestCombination.point1Index + 1}, цена $${bestCombination.point1Price.toFixed(2)}`);
  console.log(`Точка 2: день ${bestCombination.point2Index + 1}, цена $${bestCombination.point2Price.toFixed(2)}`);
  console.log(`Стратегия: ENTER=${bestCombination.entryPercent}%, EXIT=${bestCombination.exitPercent}%`);
  console.log(`Тест: ${bestCombination.testStrategy.avgPercentPerDay}% в день, ${bestCombination.testStrategy.tradesPercent}% сделок`);
  console.log(`Иссл: ${bestCombination.researchStrategy.avgPercentPerDay}% в день, ${bestCombination.researchStrategy.tradesPercent}% сделок`);

  return {
    points: [
      { index: bestCombination.point1Index, price: bestCombination.point1Price, date: testData[bestCombination.point1Index].date },
      { index: bestCombination.point2Index, price: bestCombination.point2Price, date: testData[bestCombination.point2Index].date }
    ],
    curvePoints: bestCombination.fullCurvePoints,
    percentPerDay: bestCombination.percentPerDay,
    percentPerDayPercent: ((bestCombination.percentPerDay - 1) * 100).toFixed(4),
    touches: 2,
    startPrice: bestCombination.fullCurvePoints[0].price,
    endPrice: bestCombination.fullCurvePoints[bestCombination.fullCurvePoints.length - 1].price,
    testPeriodDays: testPeriodDays,
    testStrategy: bestCombination.testStrategy,
    researchStrategy: bestCombination.researchStrategy,
    researchEndIndex: bestCombination.researchEndIndex,
    hasCrossing: bestCombination.hasCrossing,
    similarityPercent: bestCombination.similarityPercent
  };
}