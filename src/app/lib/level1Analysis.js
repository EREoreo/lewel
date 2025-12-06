// LEVEL 1 ANALYSIS - ОБНОВЛЕННАЯ ВЕРСИЯ С ДВОЙНЫМ ВЫВОДОМ
// Линия экспоненциальной поддержки (растущая)

// ========================================
// ФУНКЦИЯ ОКРУГЛЕНИЯ ЦЕН (1-5 вниз, 6-9 вверх)
// ========================================
function roundPrices(data) {
  // Функция для округления: 1-5 вниз, 6-9 вверх
  const roundPrice = (price) => {
    const shifted = price * 100;
    const floored = Math.floor(shifted);
    const decimal = shifted - floored;
    
    // Если дробная часть <= 0.5 → вниз
    // Если дробная часть > 0.5 → вверх
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
// СИМУЛЯЦИЯ ТОРГОВЛИ
// ========================================
function simulateTrading(data, curvePoints, entryPercent, exitPercent) {
  let totalProfit = 0;
  let cleanTrades = 0;
  let hasFactClose = 0;
  let inPosition = false;
  let buyPrice = 0;
  let buyDay = -1;

  for (let i = 0; i < data.length; i++) {
    const candle = data[i];
    const supportPrice = curvePoints[i].price;
    const entryPrice = supportPrice * (1 + entryPercent / 100);
    const exitPriceTarget = supportPrice * (1 + exitPercent / 100);

    if (!inPosition) {
      if (candle.low <= entryPrice) {
        inPosition = true;
        buyPrice = entryPrice;
        buyDay = i;
      }
    } else {
      const isLastDay = (i === data.length - 1);
      
      if (i === buyDay && !isLastDay) {
        continue;
      }
      
      const normalExit = candle.high >= exitPriceTarget;
      
      if (normalExit) {
        const sellPrice = exitPriceTarget;
        const profit = (sellPrice / buyPrice) * 100 - 100;
        totalProfit += profit;
        
        if (isLastDay) {
          cleanTrades++;
        } else {
          cleanTrades++;
        }
        
        inPosition = false;
        buyPrice = 0;
        buyDay = -1;
      } else if (isLastDay) {
        const sellPrice = candle.close;
        const profit = (sellPrice / buyPrice) * 100 - 100;
        totalProfit += profit;
        hasFactClose = 1;
        
        inPosition = false;
        buyPrice = 0;
        buyDay = -1;
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
function optimizeLevel1TradingStrategy(data, curvePoints, minTradesPercent = 0) {
  if (!data || data.length < 2 || !curvePoints) return null;

  let localMax = 0;
  data.forEach(candle => {
    if (candle.high > localMax) {
      localMax = candle.high;
    }
  });

  let bestStrategy = null;
  let maxAvgPercentPerDay = -Infinity;

  for (let entryPercent = 0.3; entryPercent <= 20.0; entryPercent += 0.1) {
    for (let exitPercent = entryPercent + 0.3; exitPercent <= 30.0; exitPercent += 0.1) {
      
      const maxSupportPrice = Math.max(...curvePoints.map(p => p.price));
      const exitPrice = maxSupportPrice * (1 + exitPercent / 100);
      
      if (exitPrice > localMax) {
        break;
      }

      const result = simulateTrading(data, curvePoints, entryPercent, exitPercent);
      
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
export function calculateExponentialSupportLine(data, point1MaxDay = null, point2MinDay = null, minTradesPercent = 0) {
  if (!data || data.length < 2) return null;
  
  // 🆕 ОКРУГЛЯЕМ ЦЕНЫ ДО 2 ЗНАКОВ (1-5 вниз, 6-9 вверх)
  data = roundPrices(data);
  
  let absoluteMinIndex = 0;
  let absoluteMinPrice = data[0].low;
  
  data.forEach((candle, i) => {
    if (candle.low < absoluteMinPrice) {
      absoluteMinPrice = candle.low;
      absoluteMinIndex = i;
    }
  });
  
  if (point1MaxDay !== null && absoluteMinIndex > point1MaxDay - 1) {
    console.log(`❌ Точка 1 на дне ${absoluteMinIndex + 1}, но должна быть до дня ${point1MaxDay}`);
    return null;
  }
  
  const point1 = {
    index: absoluteMinIndex,
    price: absoluteMinPrice,
    date: data[absoluteMinIndex].date
  };
  
  const candidatesRight = [];
  for (let i = absoluteMinIndex + 1; i < data.length; i++) {
    if (data[i].low > absoluteMinPrice) {
      candidatesRight.push({
        index: i,
        price: data[i].low,
        date: data[i].date
      });
    }
  }
  
  if (candidatesRight.length === 0) {
    console.log(`❌ Нет точек справа ВЫШЕ точки 1 ($${absoluteMinPrice.toFixed(2)})`);
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
    
    if (percentPerDay <= 1.0) {
      continue;
    }
    
    let isValid = true;
    
    for (let i = 0; i < data.length; i++) {
      const curvePrice = point1.price * Math.pow(percentPerDay, i - point1.index);
      
      if (data[i].low < curvePrice - 0.001) {
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
  
  if (bestCurveParams.percentPerDay <= 1.0) {
    console.log(`❌ КРИТИЧЕСКАЯ ОШИБКА: Линия падает`);
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
    const diff = Math.abs(candle.low - curvePrice);
    if (diff < 0.5) {
      touches++;
    }
  });
  
  const tradingStrategy = optimizeLevel1TradingStrategy(data, curvePoints, minTradesPercent);
  
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

// ========================================
// 🆕 ФУНКЦИЯ С ТЕСТОВЫМ ПЕРИОДОМ (ДВОЙНОЙ ПОИСК)
// ========================================
export function calculateExponentialSupportLineWithTest(data, testPeriodDays, point1MaxDay = null, point2MinDay = null, minTradesPercent = 0) {
  if (!data || data.length < 2) return null;
  if (testPeriodDays >= data.length) {
    return calculateExponentialSupportLine(data, point1MaxDay, point2MinDay, minTradesPercent);
  }

  // 🆕 ОКРУГЛЯЕМ ЦЕНЫ ДО 2 ЗНАКОВ (1-5 вниз, 6-9 вверх)
  data = roundPrices(data);

  console.log('\n🔬 НАЧАЛО ПОИСКА ЛУЧШИХ КОМБИНАЦИЙ (LEVEL 1)');
  console.log(`Тестовый участок: дни 1-${testPeriodDays}`);
  console.log(`Исследуемый участок: дни ${testPeriodDays + 1}-${data.length}`);

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
      
      if (testData[j].low <= testData[i].low) continue;
      
      const n = j - i;
      const percentPerDay = Math.pow(testData[j].low / testData[i].low, 1 / n);
      
      if (percentPerDay <= 1.0) continue;
      
      let isValid = true;
      for (let k = 0; k < testData.length; k++) {
        const curvePrice = testData[i].low * Math.pow(percentPerDay, k - i);
        if (testData[k].low < curvePrice - 0.001) {
          isValid = false;
          break;
        }
      }
      
      if (!isValid) continue;
      
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

  // 🆕 2. ДВА ТРЕКА ПОИСКА
  let bestBySimilarity = null;  // 🎯 Лучшая по схожести
  let bestByTestOnly = null;    // 🏆 Лучшая по тесту
  let maxSimilarity = -Infinity;
  let maxTestAvg = -Infinity;

  for (const combo of allCombinations) {
    let localMax = 0;
    testData.forEach(candle => {
      if (candle.high > localMax) localMax = candle.high;
    });

    for (let entryPercent = 0.3; entryPercent <= 20.0; entryPercent += 0.1) {
      for (let exitPercent = entryPercent + 0.3; exitPercent <= 30.0; exitPercent += 0.1) {
        
        const maxSupportPrice = Math.max(...combo.testCurvePoints.map(p => p.price));
        const exitPrice = maxSupportPrice * (1 + exitPercent / 100);
        if (exitPrice > localMax) break;

        // ТЕСТ
        const testResult = simulateTrading(testData, combo.testCurvePoints, entryPercent, exitPercent);
        const testTradesPercent = (testResult.cleanTrades / testData.length) * 100;
        
        if (testTradesPercent < minTradesPercent) continue;

        // 🆕 🏆 ТРЕК ТЕСТА: Проверяем максимум на тесте
        if (testResult.avgPercentPerDay > maxTestAvg) {
          maxTestAvg = testResult.avgPercentPerDay;
          
          bestByTestOnly = {
            point1Index: combo.point1Index,
            point2Index: combo.point2Index,
            point1Price: combo.point1Price,
            point2Price: combo.point2Price,
            percentPerDay: combo.percentPerDay,
            percentPerDayPercent: ((combo.percentPerDay - 1) * 100).toFixed(4),
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

        // 🎯 ТРЕК СХОЖЕСТИ: ИССЛЕДОВАНИЕ
        const fullCurvePoints = [];
        for (let k = 0; k < data.length; k++) {
          const price = combo.point1Price * Math.pow(combo.percentPerDay, k - combo.point1Index);
          fullCurvePoints.push({ index: k, price });
        }

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

        if (researchTradesPercent < minTradesPercent) continue;

        // РАСЧЕТ СХОЖЕСТИ
        const testAvg = testResult.avgPercentPerDay;
        const researchAvg = researchResult.avgPercentPerDay;
        const similarity = testAvg !== 0 ? (researchAvg / testAvg) * 100 : 0;

        if (similarity > maxSimilarity) {
          maxSimilarity = similarity;
          bestBySimilarity = {
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
  
  if (!bestBySimilarity) {
    console.log('❌ Не найдена комбинация по схожести');
    return null;
  }

  console.log(`\n🏆 ЛУЧШАЯ ПО СХОЖЕСТИ (${bestBySimilarity.similarityPercent}%):`);
  console.log(`   Точки: день ${bestBySimilarity.point1Index + 1} → день ${bestBySimilarity.point2Index + 1}`);

  if (bestByTestOnly) {
    console.log(`\n🎖️ ЛУЧШАЯ ПО ТЕСТУ (${bestByTestOnly.testStrategy.avgPercentPerDay}%):`);
    console.log(`   Точки: день ${bestByTestOnly.point1Index + 1} → день ${bestByTestOnly.point2Index + 1}`);
  }

  return {
    points: [
      { index: bestBySimilarity.point1Index, price: bestBySimilarity.point1Price, date: testData[bestBySimilarity.point1Index].date },
      { index: bestBySimilarity.point2Index, price: bestBySimilarity.point2Price, date: testData[bestBySimilarity.point2Index].date }
    ],
    curvePoints: bestBySimilarity.fullCurvePoints,
    percentPerDay: bestBySimilarity.percentPerDay,
    percentPerDayPercent: ((bestBySimilarity.percentPerDay - 1) * 100).toFixed(4),
    touches: 2,
    startPrice: bestBySimilarity.fullCurvePoints[0].price,
    endPrice: bestBySimilarity.fullCurvePoints[bestBySimilarity.fullCurvePoints.length - 1].price,
    testPeriodDays: testPeriodDays,
    testStrategy: bestBySimilarity.testStrategy,
    researchStrategy: bestBySimilarity.researchStrategy,
    researchEndIndex: bestBySimilarity.researchEndIndex,
    hasCrossing: bestBySimilarity.hasCrossing,
    similarityPercent: bestBySimilarity.similarityPercent,
    // 🆕 ДОБАВЛЯЕМ ЛУЧШУЮ ПО ТЕСТУ
    bestTestOnly: bestByTestOnly
  };
}