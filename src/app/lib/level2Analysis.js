// LEVEL 2 ANALYSIS - ВЕРСИЯ С МНОЖИТЕЛЯМИ И ПОЛНЫМИ МЕТРИКАМИ
// Линия экспоненциального сопротивления (падающая) для SHORT

// ========================================
// ФУНКЦИЯ ОКРУГЛЕНИЯ ЦЕН (1-5 вниз, 6-9 вверх)
// ========================================
function roundPrices(data) {
  const roundPrice = (price) => {
    const shifted = price * 100;
    const floored = Math.floor(shifted);
    const decimal = shifted - floored;
    
    if (decimal <= 0.5) {
      return floored / 100;
    } else {
      return Math.ceil(shifted) / 100;
    }
  };
  
  return data.map(candle => ({
    ...candle,
    low: roundPrice(candle.low),
    high: roundPrice(candle.high),
    open: roundPrice(candle.open),
    close: roundPrice(candle.close)
  }));
}

// ========================================
// СИМУЛЯЦИЯ ТОРГОВЛИ (SHORT)
// ========================================
function simulateTrading(data, curvePoints, entryPercent, exitPercent, verbose = false) {
  let totalProfit = 0;
  let cleanTrades = 0;
  let hasFactClose = 0;
  let state = 0;
  let savedEntryPrice = 0;
  let prevSavedEntryPrice = 0;
  let tradeEntryDay = -1;

  for (let i = 0; i < data.length; i++) {
    const candle = data[i];
    const resistancePrice = curvePoints[i].price;
    
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
      } else if (state === 2) {
        state = 0;
        savedEntryPrice = 0;
      }
    } else if (state === 1) {
      if (canExit) {
        const profit = (prevSavedEntryPrice / exitPriceTarget - 1) * 100;
        totalProfit += profit;
        cleanTrades++;
        state = 2;
        savedEntryPrice = 0;
      } else if (isLastDay) {
        const profit = (savedEntryPrice / candle.close - 1) * 100;
        totalProfit += profit;
        hasFactClose = 1;
      }
    }
  }

  const avgPercentPerDay = totalProfit / data.length;

  return {
    avgPercentPerDay,
    cleanTrades,
    hasFactClose,
    totalProfit
  };
}

// ========================================
// ОПТИМИЗАЦИЯ СТРАТЕГИИ (без тестового периода)
// ========================================
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
  
  for (let entryPercent = 0.3; entryPercent <= 30.0; entryPercent += 0.1) {
    for (let exitPercent = entryPercent + 0.3; exitPercent <= 30.0; exitPercent += 0.1) {
      
      const minResistancePrice = Math.min(...curvePoints.map(p => p.price));
      const exitPrice = minResistancePrice * (1 - exitPercent / 100);
      
      if (exitPrice < localMin) {
        break;
      }

      const result = simulateTrading(data, curvePoints, entryPercent, exitPercent, false);
      
      if (result) {
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
            totalTrades: result.cleanTrades,
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

// ========================================
// ОСНОВНАЯ ФУНКЦИЯ (БЕЗ тестового периода)
// ========================================
export function calculateExponentialResistanceLine(data, point1MaxDay = null, point2MinDay = null, minTradesPercent = 0, entryMultiplier = 0, exitMultiplier = 0) {
  if (!data || data.length < 2) return null;
  
  data = roundPrices(data);
  
  let absoluteMaxIndex = 0;
  let absoluteMaxPrice = data[0].high;
  
  data.forEach((candle, i) => {
    if (candle.high > absoluteMaxPrice) {
      absoluteMaxPrice = candle.high;
      absoluteMaxIndex = i;
    }
  });
  
  if (point1MaxDay !== null && absoluteMaxIndex > point1MaxDay - 1) {
    console.log(`❌ Точка 1 на дне ${absoluteMaxIndex + 1}, но должна быть до дня ${point1MaxDay}`);
    return null;
  }
  
  const point1 = {
    index: absoluteMaxIndex,
    price: absoluteMaxPrice,
    date: data[absoluteMaxIndex].date
  };
  
  const candidatesRight = [];
  for (let i = absoluteMaxIndex + 1; i < data.length; i++) {
    if (data[i].high < absoluteMaxPrice) {
      candidatesRight.push({
        index: i,
        price: data[i].high,
        date: data[i].date
      });
    }
  }
  
  if (candidatesRight.length === 0) {
    console.log(`❌ Нет точек справа НИЖЕ точки 1 ($${absoluteMaxPrice.toFixed(2)})`);
    return null;
  }
  
  let minPercentPerDay = Infinity;
  let bestPoint2 = null;
  let bestCurveParams = null;
  
  for (const candidate of candidatesRight) {
    if (point2MinDay !== null) {
      const minAllowedIndex = data.length - point2MinDay;
      if (candidate.index < minAllowedIndex) {
        continue;
      }
    }
    
    const n = candidate.index - point1.index;
    const percentPerDay = Math.pow(candidate.price / point1.price, 1 / n);
    
    if (percentPerDay >= 1.0) {
      continue;
    }
    
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
    console.log(`❌ Точка 2 не найдена`);
    return null;
  }
  
  if (bestCurveParams.percentPerDay >= 1.0) {
    console.log(`❌ КРИТИЧЕСКАЯ ОШИБКА: Линия растет`);
    return null;
  }
  
  const curvePoints = [];
  for (let i = 0; i < data.length; i++) {
    const price = bestCurveParams.basePrice * Math.pow(
      bestCurveParams.percentPerDay,
      i - bestCurveParams.baseIndex
    );
    curvePoints.push({ index: i, price });
  }
  
  let touches = 0;
  data.forEach((candle, i) => {
    const curvePrice = curvePoints[i].price;
    const diff = Math.abs(candle.high - curvePrice);
    if (diff < 0.5) {
      touches++;
    }
  });
  
  const tradingStrategy = optimizeLevel2TradingStrategy(data, curvePoints, minTradesPercent);
  
  if (!tradingStrategy && minTradesPercent > 0) {
    console.log(`❌ Не найдена стратегия с процентом сделок >= ${minTradesPercent}%`);
    return null;
  }
  
  // 🆕 ПРИМЕНЯЕМ МНОЖИТЕЛИ К СТРАТЕГИИ
  let finalStrategy = tradingStrategy;
  if (tradingStrategy && (entryMultiplier !== 0 || exitMultiplier !== 0)) {
    const originalEntry = parseFloat(tradingStrategy.entryPercent);
    const originalExit = parseFloat(tradingStrategy.exitPercent);
    const range = originalExit - originalEntry;
    
    const newEntry = parseFloat((originalEntry + range * entryMultiplier).toFixed(2));
    const newExit = parseFloat((originalExit - range * exitMultiplier).toFixed(2));
    
    const simulation = simulateTrading(data, curvePoints, newEntry, newExit);
    const tradesPercent = (simulation.cleanTrades / data.length) * 100;
    
    finalStrategy = {
      entryPercent: parseFloat(newEntry.toFixed(2)),
      exitPercent: parseFloat(newExit.toFixed(2)),
      avgPercentPerDay: parseFloat(simulation.avgPercentPerDay.toFixed(2)),
      totalTrades: simulation.cleanTrades,
      totalDays: data.length,
      hasFactClose: simulation.hasFactClose,
      tradesPercent: parseFloat(tradesPercent.toFixed(2)),
      totalProfit: parseFloat(simulation.totalProfit.toFixed(2))
    };
  }
  
  return {
    points: [point1, bestPoint2],
    curvePoints: curvePoints,
    percentPerDay: bestCurveParams.percentPerDay,
    percentPerDayPercent: ((bestCurveParams.percentPerDay - 1) * 100).toFixed(4),
    touches: Math.max(touches, 2),
    startPrice: curvePoints[0].price,
    endPrice: curvePoints[curvePoints.length - 1].price,
    tradingStrategy: finalStrategy,
    entryMultiplier: entryMultiplier,
    exitMultiplier: exitMultiplier
  };
}

// ========================================
// 🆕 ФУНКЦИЯ С ТЕСТОВЫМ ПЕРИОДОМ И МНОЖИТЕЛЯМИ
// ========================================
export function calculateExponentialResistanceLineWithTest(data, testPeriodDays, point1MaxDay = null, point2MinDay = null, minTradesPercent = 0, entryMultiplier = 0, exitMultiplier = 0) {
  if (!data || data.length < 2) return null;
  if (testPeriodDays >= data.length) {
    return calculateExponentialResistanceLine(data, point1MaxDay, point2MinDay, minTradesPercent);
  }

  data = roundPrices(data);

  console.log('\n🔬 НАЧАЛО ПОИСКА ЛУЧШЕЙ КОМБИНАЦИИ (LEVEL 2)');
  console.log(`Тестовый участок: дни 1-${testPeriodDays}`);
  console.log(`Исследуемый участок: дни ${testPeriodDays + 1}-${data.length}`);
  console.log(`Множители: вход × ${entryMultiplier}, выход × ${exitMultiplier}`);

  const testData = data.slice(0, testPeriodDays);

  // 1. НАХОДИМ ВСЕ ВОЗМОЖНЫЕ КОМБИНАЦИИ ТОЧЕК
  const allCombinations = [];
  
  for (let i = 0; i < testData.length; i++) {
    if (point1MaxDay !== null && i > point1MaxDay - 1) continue;
    
    for (let j = i + 1; j < testData.length; j++) {
      if (point2MinDay !== null) {
        const minAllowedIndex = testData.length - point2MinDay;
        if (j < minAllowedIndex) continue;
      }
      
      if (testData[j].high >= testData[i].high) continue;
      
      const n = j - i;
      const percentPerDay = Math.pow(testData[j].high / testData[i].high, 1 / n);
      
      if (percentPerDay >= 1.0) continue;
      
      let isValid = true;
      for (let k = 0; k < testData.length; k++) {
        const curvePrice = testData[i].high * Math.pow(percentPerDay, k - i);
        if (testData[k].high > curvePrice + 0.001) {
          isValid = false;
          break;
        }
      }
      
      if (!isValid) continue;
      
      const testCurvePoints = [];
      for (let k = 0; k < testData.length; k++) {
        const price = testData[i].high * Math.pow(percentPerDay, k - i);
        testCurvePoints.push({ index: k, price });
      }
      
      allCombinations.push({
        point1Index: i,
        point2Index: j,
        point1Price: testData[i].high,
        point2Price: testData[j].high,
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

  // 2. ИЩЕМ ЛУЧШУЮ КОМБИНАЦИЮ НА ТЕСТЕ
  let bestCombo = null;
  let maxTestAvg = -Infinity;

  for (const combo of allCombinations) {
    let localMin = Infinity;
    testData.forEach(candle => {
      if (candle.low < localMin) localMin = candle.low;
    });

    for (let entryPercent = 0.3; entryPercent <= 30.0; entryPercent += 0.1) {
      for (let exitPercent = entryPercent + 0.3; exitPercent <= 30.0; exitPercent += 0.1) {
        
        const minResistancePrice = Math.min(...combo.testCurvePoints.map(p => p.price));
        const exitPrice = minResistancePrice * (1 - exitPercent / 100);
        if (exitPrice < localMin) break;

        const testResult = simulateTrading(testData, combo.testCurvePoints, entryPercent, exitPercent, false);
        const testTradesPercent = (testResult.cleanTrades / testData.length) * 100;
        
        if (testTradesPercent < minTradesPercent) continue;

        if (testResult.avgPercentPerDay > maxTestAvg) {
          maxTestAvg = testResult.avgPercentPerDay;
          
          bestCombo = {
            point1Index: combo.point1Index,
            point2Index: combo.point2Index,
            point1Price: combo.point1Price,
            point2Price: combo.point2Price,
            percentPerDay: combo.percentPerDay,
            percentPerDayPercent: ((combo.percentPerDay - 1) * 100).toFixed(4),
            testCurvePoints: combo.testCurvePoints,
            testStrategy: {
              avgPercentPerDay: testResult.avgPercentPerDay.toFixed(4),
              entryPercent: entryPercent.toFixed(1),
              exitPercent: exitPercent.toFixed(1),
              totalTrades: testResult.cleanTrades,
              totalDays: testData.length,
              hasFactClose: testResult.hasFactClose,
              tradesPercent: testTradesPercent.toFixed(2),
              totalProfit: testResult.totalProfit.toFixed(2)
            }
          };
        }
      }
    }
  }
  
  if (!bestCombo) {
    console.log('❌ Не найдена комбинация на тестовом периоде');
    return null;
  }

  console.log(`\n🏆 ЛУЧШАЯ КОМБИНАЦИЯ НА ТЕСТЕ (${bestCombo.testStrategy.avgPercentPerDay}%):`);
  console.log(`   Точки: день ${bestCombo.point1Index + 1} → день ${bestCombo.point2Index + 1}`);
  console.log(`   Вход: ${bestCombo.testStrategy.entryPercent}%, Выход: ${bestCombo.testStrategy.exitPercent}%`);

  // 3. ПРИМЕНЯЕМ МНОЖИТЕЛИ И ТЕСТИРУЕМ НА ИССЛЕДУЕМОМ ПЕРИОДЕ
  const fullCurvePoints = [];
  for (let k = 0; k < data.length; k++) {
    const price = bestCombo.point1Price * Math.pow(bestCombo.percentPerDay, k - bestCombo.point1Index);
    fullCurvePoints.push({ index: k, price });
  }

  // Проверяем пересечение на исследуемом периоде
  let researchEndIndex = data.length - 1;
  let hasCrossing = false;
  for (let k = testPeriodDays; k < data.length; k++) {
    if (data[k].high > fullCurvePoints[k].price + 0.001) {
      researchEndIndex = k - 1;
      hasCrossing = true;
      break;
    }
  }

  const researchDataForCalc = data.slice(testPeriodDays, researchEndIndex + 1);
  
  if (researchDataForCalc.length === 0) {
    console.log('⚠️ Исследуемый период пуст из-за пересечения');
    return {
      points: [
        { index: bestCombo.point1Index, price: bestCombo.point1Price, date: testData[bestCombo.point1Index].date },
        { index: bestCombo.point2Index, price: bestCombo.point2Price, date: testData[bestCombo.point2Index].date }
      ],
      curvePoints: fullCurvePoints,
      percentPerDay: bestCombo.percentPerDay,
      percentPerDayPercent: bestCombo.percentPerDayPercent,
      touches: 2,
      startPrice: fullCurvePoints[0].price,
      endPrice: fullCurvePoints[fullCurvePoints.length - 1].price,
      testPeriodDays: testPeriodDays,
      testStrategy: bestCombo.testStrategy,
      researchStrategy: null,
      researchEndIndex: researchEndIndex,
      hasCrossing: hasCrossing
    };
  }

  const researchCurvePoints = fullCurvePoints.slice(testPeriodDays, researchEndIndex + 1).map((p, idx) => ({
    index: idx,
    price: p.price
  }));

  // ПРИМЕНЯЕМ МНОЖИТЕЛИ
  const originalEntry = parseFloat(bestCombo.testStrategy.entryPercent);
  const originalExit = parseFloat(bestCombo.testStrategy.exitPercent);
  const range = originalExit - originalEntry;
  
  const modifiedEntryPercent = parseFloat((originalEntry + range * entryMultiplier).toFixed(2));
  const modifiedExitPercent = parseFloat((originalExit - range * exitMultiplier).toFixed(2));

  console.log(`\n🔄 ПРИМЕНЯЕМ МНОЖИТЕЛИ:`);
  console.log(`   Оригинал: вход ${originalEntry}%, выход ${originalExit}%, диапазон ${range.toFixed(2)}%`);
  console.log(`   Новый вход: ${originalEntry}% + ${range.toFixed(2)}% × ${entryMultiplier} = ${modifiedEntryPercent.toFixed(2)}%`);
  console.log(`   Новый выход: ${originalExit}% - ${range.toFixed(2)}% × ${exitMultiplier} = ${modifiedExitPercent.toFixed(2)}%`);

  // 🔥 ЗАПУСКАЕМ СИМУЛЯЦИЮ С НОВЫМИ ПРОЦЕНТАМИ
  const researchResult = simulateTrading(researchDataForCalc, researchCurvePoints, modifiedEntryPercent, modifiedExitPercent, false);
  const researchTradesPercent = (researchResult.cleanTrades / researchDataForCalc.length) * 100;

  console.log(`\n📊 РЕЗУЛЬТАТ НА ИССЛЕДУЕМОМ ПЕРИОДЕ:`);
  console.log(`   Средний %: ${researchResult.avgPercentPerDay.toFixed(4)}%`);
  console.log(`   Трейды: ${researchResult.cleanTrades}`);
  console.log(`   Всего дней: ${researchDataForCalc.length}`);
  console.log(`   % сделок: ${researchTradesPercent.toFixed(2)}%`);
  console.log(`   Общая прибыль: ${researchResult.totalProfit.toFixed(2)}%`);
  console.log(`   Закрыто по факту: ${researchResult.hasFactClose}`);

  return {
    points: [
      { index: bestCombo.point1Index, price: bestCombo.point1Price, date: testData[bestCombo.point1Index].date },
      { index: bestCombo.point2Index, price: bestCombo.point2Price, date: testData[bestCombo.point2Index].date }
    ],
    curvePoints: fullCurvePoints,
    percentPerDay: bestCombo.percentPerDay,
    percentPerDayPercent: bestCombo.percentPerDayPercent,
    touches: 2,
    startPrice: fullCurvePoints[0].price,
    endPrice: fullCurvePoints[fullCurvePoints.length - 1].price,
    testPeriodDays: testPeriodDays,
    testStrategy: bestCombo.testStrategy,
    // 🔥 ВСЕ МЕТРИКИ ДЛЯ ИССЛЕДУЕМОГО УЧАСТКА
    researchStrategy: {
      avgPercentPerDay: parseFloat(researchResult.avgPercentPerDay.toFixed(4)),
      entryPercent: parseFloat(modifiedEntryPercent.toFixed(2)),
      exitPercent: parseFloat(modifiedExitPercent.toFixed(2)),
      totalTrades: researchResult.cleanTrades,           // 🔥 ТРЕЙДЫ
      totalDays: researchDataForCalc.length,             // 🔥 ВСЕГО ДНЕЙ
      hasFactClose: researchResult.hasFactClose,         // 🔥 ЗАКРЫТО ПО ФАКТУ
      tradesPercent: parseFloat(researchTradesPercent.toFixed(2)),
      totalProfit: parseFloat(researchResult.totalProfit.toFixed(2))  // 🔥 ОБЩАЯ ПРИБЫЛЬ
    },
    researchEndIndex: researchEndIndex,
    hasCrossing: hasCrossing,
    entryMultiplier: entryMultiplier,
    exitMultiplier: exitMultiplier
  };
}