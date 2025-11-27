// Симуляция торговли - ТОЧНО КАК В EXCEL!
// verbose = true: детальный лог каждой сделки
// verbose = false: только итоговая статистика
function simulateTrading(data, curvePoints, entryPercent, exitPercent, verbose = false) {
  let totalProfit = 0;
  let cleanTrades = 0; // НОВОЕ: Чистые сделки (закрытые НЕ в последний день)
  let hasFactClose = 0; // НОВОЕ: Есть ли сделка закрытая по факту
  let state = 0; // 0 = нет позиции, 1 = в позиции, 2 = только что закрыли
  let savedEntryPrice = 0;
  let prevSavedEntryPrice = 0;
  let tradeEntryDay = -1;

  for (let i = 0; i < data.length; i++) {
    const candle = data[i];
    const resistancePrice = curvePoints[i].price;
    const dateStr = new Date(candle.date).toLocaleDateString('ru-RU');
    
    const entryPrice = resistancePrice * (1 - entryPercent / 100);
    const exitPriceTarget = resistancePrice * (1 - exitPercent / 100);

    const canEnter = entryPrice < candle.high;
    const canExit = exitPriceTarget > candle.low;

    prevSavedEntryPrice = savedEntryPrice;
    const isLastDay = (i === data.length - 1);

    if (state === 0 || state === 2) {
      if (canEnter) {
        state = 1;
        savedEntryPrice = entryPrice;
        tradeEntryDay = i;
        
        if (verbose) {
          console.log(`\n🔴 ВХОД В SHORT #${cleanTrades + 1}`);
          console.log(`   День: ${i + 1} (${dateStr})`);
          console.log(`   Цена продажи: $${entryPrice.toFixed(2)}`);
        }
      } else if (state === 2) {
        state = 0;
        savedEntryPrice = 0;
      }
    } else if (state === 1) {
      if (canExit) {
        // НОРМАЛЬНЫЙ ВЫХОД
        const profit = (prevSavedEntryPrice / exitPriceTarget - 1) * 100;
        totalProfit += profit;
        
        // Любой нормальный выход считается чистым
        cleanTrades++;
        
        if (verbose) {
          console.log(`\n🟢 ВЫХОД ИЗ SHORT #${cleanTrades}`);
          console.log(`   День: ${i + 1} (${dateStr})`);
          console.log(`   💰 ПРИБЫЛЬ: ${profit.toFixed(2)}%`);
        }
        
        state = 2;
        savedEntryPrice = 0;
      }
      else if (isLastDay) {
        // ВЫХОД ПО ФАКТУ
        const profit = (savedEntryPrice / candle.close - 1) * 100;
        totalProfit += profit;
        hasFactClose = 1;
        
        if (verbose) {
          console.log(`\n⚠️ ПРИНУДИТЕЛЬНОЕ ЗАКРЫТИЕ (последний день)`);
          console.log(`   💰 ПРИБЫЛЬ: ${profit.toFixed(2)}%`);
        }
      }
    }
  }

  const avgPercentPerDay = totalProfit / data.length;

  if (verbose) {
    console.log(`\n📊 ИТОГО: ${cleanTrades} чистых сделок, ${hasFactClose} по факту`);
    console.log(`Средний %: ${avgPercentPerDay.toFixed(4)}%\n`);
  }

  return {
    avgPercentPerDay,
    cleanTrades,
    hasFactClose,
    totalProfit
  };
}

// Функция для оптимизации стратегии торговли
function optimizeLevel2TradingStrategy(data, curvePoints, minTradesPercent = 0) {
  if (!data || data.length < 2 || !curvePoints) return null;

  let localMin = Infinity;
  data.forEach(candle => {
    if (candle.low < localMin) {
      localMin = candle.low;
    }
  });

  let bestStrategy = null;
  let maxAvgPercentPerDay = -Infinity;

  console.log('\n🔍 ОПТИМИЗАЦИЯ LEVEL 2 (SHORT)');
  
  for (let entryPercent = 0.3; entryPercent <= 30.0; entryPercent += 0.1) {
    for (let exitPercent = entryPercent + 0.3; exitPercent <= 30.0; exitPercent += 0.1) {
      
      const minResistancePrice = Math.min(...curvePoints.map(p => p.price));
      const exitPrice = minResistancePrice * (1 - exitPercent / 100);
      
      if (exitPrice < localMin) {
        break;
      }

      const result = simulateTrading(data, curvePoints, entryPercent, exitPercent, false);
      
      if (result) {
        // НОВОЕ: Проверяем процент сделок
        const tradesPercent = (result.cleanTrades / data.length) * 100;
        
        if (tradesPercent < minTradesPercent) {
          continue;
        }
        
        if (result.avgPercentPerDay > maxAvgPercentPerDay) {
          maxAvgPercentPerDay = result.avgPercentPerDay;
          bestStrategy = {
            entryPercent: entryPercent.toFixed(1),
            exitPercent: exitPercent.toFixed(1),
            avgPercentPerDay: result.avgPercentPerDay.toFixed(4),
            totalTrades: result.cleanTrades, // НОВОЕ: только чистые
            totalDays: data.length,
            hasFactClose: result.hasFactClose,
            tradesPercent: tradesPercent.toFixed(2),
            totalProfit: result.totalProfit.toFixed(2)
          };
          
          console.log(`✨ Новый рекорд: ${entryPercent.toFixed(1)}%/${exitPercent.toFixed(1)}% → ${result.avgPercentPerDay.toFixed(4)}%`);
        }
      }
    }
  }

  if (bestStrategy) {
    console.log(`\n🏆 ОПТИМАЛЬНАЯ СТРАТЕГИЯ:`);
    console.log(`   ENTER: ${bestStrategy.entryPercent}%, EXIT: ${bestStrategy.exitPercent}%`);
    console.log(`   Средний %: ${bestStrategy.avgPercentPerDay}%`);
    console.log(`   Трейдов: ${bestStrategy.totalTrades}, Процент сделок: ${bestStrategy.tradesPercent}%`);
  }

  return bestStrategy;
}

export function calculateExponentialResistanceLine(data, point1MaxDay = null, point2MinDay = null, minTradesPercent = 0) {
  if (!data || data.length < 2) return null;
  
  // 1. Находим абсолютный максимум
  let absoluteMaxIndex = 0;
  let absoluteMaxPrice = data[0].high;
  
  data.forEach((candle, i) => {
    if (candle.high > absoluteMaxPrice) {
      absoluteMaxPrice = candle.high;
      absoluteMaxIndex = i;
    }
  });
  
  // НОВОЕ: Проверка точки 1
  if (point1MaxDay !== null && absoluteMaxIndex > point1MaxDay - 1) {
    console.log(`❌ Точка 1 на дне ${absoluteMaxIndex + 1}, но должна быть до дня ${point1MaxDay}`);
    return null;
  }
  
  const point1 = {
    index: absoluteMaxIndex,
    price: absoluteMaxPrice,
    date: data[absoluteMaxIndex].date
  };
  
  // 2. Ищем точки справа
  const candidatesRight = [];
  for (let i = absoluteMaxIndex + 1; i < data.length; i++) {
    candidatesRight.push({
      index: i,
      price: data[i].high,
      date: data[i].date
    });
  }
  
  if (candidatesRight.length === 0) return null;
  
  // 3. Перебираем точки
  let minPercentPerDay = Infinity;
  let bestPoint2 = null;
  let bestCurveParams = null;
  
  for (const candidate of candidatesRight) {
    // НОВОЕ: Проверка точки 2 (от конца)
    if (point2MinDay !== null) {
      const minAllowedIndex = data.length - point2MinDay;
      if (candidate.index < minAllowedIndex) {
        continue;
      }
    }
    
    const n = candidate.index - point1.index;
    const percentPerDay = Math.pow(candidate.price / point1.price, 1 / n);
    
    let isValid = true;
    
    for (let i = 0; i < data.length; i++) {
      const curvePrice = point1.price * Math.pow(percentPerDay, i - point1.index);
      
      if (data[i].high > curvePrice + 0.001) {
        isValid = false;
        break;
      }
    }
    
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
  
  if (!bestPoint2) {
    console.log(`❌ Точка 2 не найдена в последних ${point2MinDay || 'любых'} днях`);
    return null;
  }
  
  console.log(`✅ Точка 1: день ${point1.index + 1}, Точка 2: день ${bestPoint2.index + 1}`);
  
  // 4. Формируем кривую
  const curvePoints = [];
  for (let i = 0; i < data.length; i++) {
    const price = bestCurveParams.basePrice * Math.pow(
      bestCurveParams.percentPerDay,
      i - bestCurveParams.baseIndex
    );
    curvePoints.push({ index: i, price });
  }
  
  // 5. Касания
  let touches = 0;
  data.forEach((candle, i) => {
    const curvePrice = curvePoints[i].price;
    const diff = Math.abs(candle.high - curvePrice);
    if (diff < 0.5) {
      touches++;
    }
  });
  
  // 6. Оптимизация
  const tradingStrategy = optimizeLevel2TradingStrategy(data, curvePoints, minTradesPercent);
  
  // НОВОЕ: Если стратегия не найдена - возвращаем null
  if (!tradingStrategy && minTradesPercent > 0) {
    console.log(`❌ Не найдена стратегия с процентом сделок >= ${minTradesPercent}%`);
    return null;
  }
  
  return {
    points: [point1, bestPoint2],
    curvePoints: curvePoints,
    percentPerDay: bestCurveParams.percentPerDay,
    percentPerDayPercent: ((bestCurveParams.percentPerDay - 1) * 100).toFixed(4),
    touches: Math.max(touches, 2),
    startPrice: curvePoints[0].price,
    endPrice: curvePoints[curvePoints.length - 1].price,
    tradingStrategy: tradingStrategy
  };
}

// НОВАЯ функция с разделением на тестируемый и исследуемый участок
export function calculateExponentialResistanceLineWithTest(data, testPeriodDays, point1MaxDay = null, point2MinDay = null, minTradesPercent = 0) {
  if (!data || data.length < 2) return null;
  if (testPeriodDays >= data.length) {
    // Если тестовый период больше или равен всем данным, используем обычную логику
    return calculateExponentialResistanceLine(data, point1MaxDay, point2MinDay, minTradesPercent);
  }

  // Разделяем данные на два участка
  const testData = data.slice(0, testPeriodDays);

  console.log('\n🔬 РАЗДЕЛЕНИЕ НА УЧАСТКИ (LEVEL 2):');
  console.log(`Тестируемый участок: дни 1-${testPeriodDays} (${testPeriodDays} дней)`);
  console.log(`Исследуемый участок: дни ${testPeriodDays + 1}-${data.length} (${data.length - testPeriodDays} дней)`);

  // 1. Находим линию сопротивления на тестируемом участке
  const testResult = calculateExponentialResistanceLine(testData, point1MaxDay, point2MinDay, minTradesPercent);
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

  // 2. Продолжаем линию сопротивления на исследуемый участок
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
    // Для сопротивления: пересечение когда свеча ВЫШЕ линии
    if (data[i].high > curvePrice + 0.001) {
      researchEndIndex = i - 1;
      hasCrossing = true;
      console.log(`\n⚠️ ПЕРЕСЕЧЕНИЕ в день ${i + 1}: цена $${data[i].high.toFixed(2)} > линия $${curvePrice.toFixed(2)}`);
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
    
    const result = simulateTrading(researchDataForCalc, researchCurvePoints, entryPercent, exitPercent, false);
    const tradesPercent = (result.cleanTrades / researchDataForCalc.length) * 100;
    
    researchStrategy = {
      avgPercentPerDay: result.avgPercentPerDay.toFixed(4),
      totalTrades: result.cleanTrades,
      totalDays: researchDataForCalc.length,
      hasFactClose: result.hasFactClose,
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