// LEVEL 1 ANALYSIS - ВЕРСИЯ С НОВОЙ ЛОГИКОЙ ТОРГОВЛИ (СТОП-ЛОСС)
// Линия экспоненциальной поддержки (растущая) для LONG

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
// 🆕 НОВАЯ СИМУЛЯЦИЯ ТОРГОВЛИ С СТОП-ЛОССОМ
// ========================================
function simulateTradingWithStop(data, curvePoints, entryPercent, exitPercent, stopPercent) {
  const m = data.length;
  let n = 0;
  let t_c = 0;  // чистые трейды
  let t_f = 0;  // трейды закрытые по факту
  let E_percent = 0;  // сумма % по всем трейдам
  let Pt1 = 0;  // цена входа
  let inPosition = false;

  while (n < m) {
    const candle = data[n];
    const Pl_n = curvePoints[n].price;
    const P_enter_n = Pl_n * (entryPercent / 100 + 1);
    const P_exit_n = Pl_n * (exitPercent / 100 + 1);
    const P_stop_n = Pl_n * (1 - stopPercent / 100);

    // ШАГ 1: Проверка пересечения линии поддержки
    if (candle.open <= Pl_n) {
      // Линия пробита - прекращаем торговлю
      break;
    }

    if (!inPosition) {
      // ШАГ 2: Проверка входа по open
      if (candle.open < P_enter_n) {
        Pt1 = candle.open;
        inPosition = true;
        
        // ШАГ 3: Проверка стоп-лосса
        if (candle.low <= P_stop_n) {
          const Pt2 = P_stop_n;
          E_percent += (Pt2 / Pt1 - 1) * 100;
          t_f++;
          inPosition = false;
          n++;
          continue;
        }
        
        // ШАГ 4: Проверка выхода
        if (candle.high >= P_exit_n) {
          const Pt2 = P_exit_n;
          E_percent += (Pt2 / Pt1 - 1) * 100;
          t_c++;
          inPosition = false;
          n++;
          continue;
        }
        
        // ШАГ 5: Проверка пересечения линии
        if (candle.low <= Pl_n) {
          const Pt2 = candle.close;
          E_percent += (Pt2 / Pt1 - 1) * 100;
          t_f++;
          inPosition = false;
          break;  // конец торговли
        }
        
        // Продолжаем держать позицию
        n++;
        continue;
      }
      
      // ШАГ 6: Проверка входа по min
      if (candle.low < P_enter_n) {
        Pt1 = P_enter_n;
        inPosition = true;
        
        // ШАГ 7: Проверка стоп-лосса
        if (candle.low <= P_stop_n) {
          const Pt2 = P_stop_n;
          E_percent += (Pt2 / Pt1 - 1) * 100;
          t_f++;
          inPosition = false;
          break;  // конец торговли
        }
        
        // Продолжаем держать позицию
        n++;
        continue;
      }
      
      // Не вошли в позицию - переход к следующему дню
      n++;
      continue;
    }

    // В ПОЗИЦИИ
    // ШАГ 10: Проверка последнего дня
    if (n === m - 1) {
      const Pt2 = candle.close;
      E_percent += (Pt2 / Pt1 - 1) * 100;
      t_f++;
      break;
    }

    // ШАГ 11: Проверка стоп-лосса по open
    if (candle.open <= P_stop_n) {
      const Pt2 = candle.open;
      E_percent += (Pt2 / Pt1 - 1) * 100;
      t_f++;
      inPosition = false;
      break;  // конец торговли
    }

    // ШАГ 12: Проверка выхода
    if (candle.high >= P_exit_n) {
      const Pt2 = P_exit_n;
      E_percent += (Pt2 / Pt1 - 1) * 100;
      t_c++;
      inPosition = false;
      n++;
      continue;
    }

    // ШАГ 13: Проверка пересечения линии
    if (candle.low <= Pl_n) {
      const Pt2 = candle.close;
      E_percent += (Pt2 / Pt1 - 1) * 100;
      t_f++;
      inPosition = false;
      break;  // конец торговли
    }

    // Продолжаем держать позицию
    n++;
  }

  const avgPercentPerDay = m > 0 ? E_percent / m : 0;

  return {
    avgPercentPerDay,
    cleanTrades: t_c,
    hasFactClose: t_f,
    totalProfit: E_percent,
    totalTrades: t_c + t_f
  };
}

// ========================================
// СТАРАЯ СИМУЛЯЦИЯ ТОРГОВЛИ (БЕЗ СТОПА) - ДЛЯ ОБРАТНОЙ СОВМЕСТИМОСТИ
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
      
      if (i === buyDay && isLastDay) {
        const sellPrice = candle.close;
        const profit = (sellPrice / buyPrice) * 100 - 100;
        totalProfit += profit;
        hasFactClose = 1;
        
        inPosition = false;
        buyPrice = 0;
        buyDay = -1;
        continue;
      }
      
      if (i === buyDay && !isLastDay) {
        continue;
      }
      
      const normalExit = candle.high >= exitPriceTarget;
      
      if (normalExit) {
        const sellPrice = exitPriceTarget;
        const profit = (sellPrice / buyPrice) * 100 - 100;
        totalProfit += profit;
        cleanTrades++;
        
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
// 🆕 ОПТИМИЗАЦИЯ СТРАТЕГИИ С СТОП-ЛОССОМ
// ========================================
function optimizeLevel1TradingStrategyWithStop(data, curvePoints, minTradesPercent = 0) {
  if (!data || data.length < 2 || !curvePoints) return null;

  let localMax = 0;
  data.forEach(candle => {
    if (candle.high > localMax) {
      localMax = candle.high;
    }
  });

  let bestStrategy = null;
  let maxAvgPercentPerDay = -Infinity;

  // Перебор параметров с учетом стоп-лосса
  for (let stopPercent = 1.0; stopPercent <= 10.0; stopPercent += 0.5) {
    for (let entryPercent = 0.3; entryPercent <= 20.0; entryPercent += 0.1) {
      for (let exitPercent = entryPercent + 0.3; exitPercent <= 30.0; exitPercent += 0.1) {
        
        const maxSupportPrice = Math.max(...curvePoints.map(p => p.price));
        const exitPrice = maxSupportPrice * (1 + exitPercent / 100);
        
        if (exitPrice > localMax) {
          break;
        }

        const result = simulateTradingWithStop(data, curvePoints, entryPercent, exitPercent, stopPercent);
        
        if (result && result.totalTrades > 0) {
          const tradesPercent = (result.totalTrades / data.length) * 100;
          
          if (tradesPercent < minTradesPercent) {
            continue;
          }
          
          if (result.avgPercentPerDay > maxAvgPercentPerDay) {
            maxAvgPercentPerDay = result.avgPercentPerDay;
            bestStrategy = {
              entryPercent: parseFloat(entryPercent.toFixed(1)),
              exitPercent: parseFloat(exitPercent.toFixed(1)),
              stopPercent: parseFloat(stopPercent.toFixed(1)),
              avgPercentPerDay: parseFloat(result.avgPercentPerDay.toFixed(4)),
              totalTrades: result.cleanTrades,
              totalDays: data.length,
              hasFactClose: result.hasFactClose,
              tradesPercent: parseFloat(tradesPercent.toFixed(2)),
              totalProfit: parseFloat(result.totalProfit.toFixed(2))
            };
          }
        }
      }
    }
  }

  return bestStrategy;
}

// ========================================
// ОПТИМИЗАЦИЯ СТРАТЕГИИ (без стоп-лосса) - ДЛЯ ОБРАТНОЙ СОВМЕСТИМОСТИ
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
export function calculateExponentialSupportLine(data, point1MaxDay = null, point2MinDay = null, minTradesPercent = 0, entryMultiplier = 0, exitMultiplier = 0, useStopLoss = false) {
  if (!data || data.length < 2) return null;
  
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
  
  // 🆕 Выбираем функцию оптимизации в зависимости от параметра useStopLoss
  const tradingStrategy = useStopLoss
    ? optimizeLevel1TradingStrategyWithStop(data, curvePoints, minTradesPercent)
    : optimizeLevel1TradingStrategy(data, curvePoints, minTradesPercent);
  
  if (!tradingStrategy && minTradesPercent > 0) {
    console.log(`❌ Не найдена стратегия с процентом сделок >= ${minTradesPercent}%`);
    return null;
  }
  
  let finalStrategy = tradingStrategy;
  if (tradingStrategy && (entryMultiplier !== 0 || exitMultiplier !== 0)) {
    const originalEntry = parseFloat(tradingStrategy.entryPercent);
    const originalExit = parseFloat(tradingStrategy.exitPercent);
    const range = originalExit - originalEntry;
    
    const newEntry = parseFloat((originalEntry + range * entryMultiplier).toFixed(2));
    const newExit = parseFloat((originalExit - range * exitMultiplier).toFixed(2));
    
    const simulation = useStopLoss && tradingStrategy.stopPercent
      ? simulateTradingWithStop(data, curvePoints, newEntry, newExit, tradingStrategy.stopPercent)
      : simulateTrading(data, curvePoints, newEntry, newExit);
    
    const tradesPercent = useStopLoss
      ? (simulation.totalTrades / data.length) * 100
      : (simulation.cleanTrades / data.length) * 100;
    
    finalStrategy = {
      entryPercent: parseFloat(newEntry.toFixed(2)),
      exitPercent: parseFloat(newExit.toFixed(2)),
      stopPercent: tradingStrategy.stopPercent || null,
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
    exitMultiplier: exitMultiplier,
    useStopLoss: useStopLoss
  };
}

// ========================================
// 🆕 ФУНКЦИЯ С ТЕСТОВЫМ ПЕРИОДОМ (С НОВОЙ ЛОГИКОЙ)
// ========================================
export function calculateExponentialSupportLineWithTest(data, testPeriodDays, point1MaxDay = null, point2MinDay = null, minTradesPercent = 0, entryMultiplier = 0, exitMultiplier = 0, useStopLoss = false) {
  if (!data || data.length < 2) return null;
  if (testPeriodDays >= data.length) {
    return calculateExponentialSupportLine(data, point1MaxDay, point2MinDay, minTradesPercent, entryMultiplier, exitMultiplier, useStopLoss);
  }

  data = roundPrices(data);

  console.log('\n🔬 НАЧАЛО ПОИСКА ЛУЧШЕЙ КОМБИНАЦИИ (LEVEL 1)');
  console.log(`Тестовый участок: дни 1-${testPeriodDays}`);
  console.log(`Исследуемый участок: дни ${testPeriodDays + 1}-${data.length}`);
  console.log(`Множители: вход × ${entryMultiplier}, выход × ${exitMultiplier}`);
  console.log(`Стоп-лосс: ${useStopLoss ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН'}`);

  const testData = data.slice(0, testPeriodDays);

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

  let bestCombo = null;
  let maxTestAvg = -Infinity;

  for (const combo of allCombinations) {
    let localMax = 0;
    testData.forEach(candle => {
      if (candle.high > localMax) localMax = candle.high;
    });

    if (useStopLoss) {
      // Оптимизация с стоп-лоссом
      for (let stopPercent = 1.0; stopPercent <= 10.0; stopPercent += 0.5) {
        for (let entryPercent = 0.3; entryPercent <= 20.0; entryPercent += 0.1) {
          for (let exitPercent = entryPercent + 0.3; exitPercent <= 30.0; exitPercent += 0.1) {
            
            const maxSupportPrice = Math.max(...combo.testCurvePoints.map(p => p.price));
            const exitPrice = maxSupportPrice * (1 + exitPercent / 100);
            if (exitPrice > localMax) break;

            const testResult = simulateTradingWithStop(testData, combo.testCurvePoints, entryPercent, exitPercent, stopPercent);
            
            if (!testResult || testResult.totalTrades === 0) continue;
            
            const testTradesPercent = (testResult.totalTrades / testData.length) * 100;
            
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
                  stopPercent: stopPercent.toFixed(1),
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
    } else {
      // Оптимизация без стоп-лосса (старая логика)
      for (let entryPercent = 0.3; entryPercent <= 20.0; entryPercent += 0.1) {
        for (let exitPercent = entryPercent + 0.3; exitPercent <= 30.0; exitPercent += 0.1) {
          
          const maxSupportPrice = Math.max(...combo.testCurvePoints.map(p => p.price));
          const exitPrice = maxSupportPrice * (1 + exitPercent / 100);
          if (exitPrice > localMax) break;

          const testResult = simulateTrading(testData, combo.testCurvePoints, entryPercent, exitPercent);
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
                stopPercent: null,
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
  }
  
  if (!bestCombo) {
    console.log('❌ Не найдена комбинация на тестовом периоде');
    return null;
  }

  console.log(`\n🏆 ЛУЧШАЯ КОМБИНАЦИЯ НА ТЕСТЕ (${bestCombo.testStrategy.avgPercentPerDay}%):`);
  console.log(`   Точки: день ${bestCombo.point1Index + 1} → день ${bestCombo.point2Index + 1}`);
  console.log(`   Вход: ${bestCombo.testStrategy.entryPercent}%, Выход: ${bestCombo.testStrategy.exitPercent}%`);
  if (useStopLoss) {
    console.log(`   Стоп: ${bestCombo.testStrategy.stopPercent}%`);
  }

  const fullCurvePoints = [];
  for (let k = 0; k < data.length; k++) {
    const price = bestCombo.point1Price * Math.pow(bestCombo.percentPerDay, k - bestCombo.point1Index);
    fullCurvePoints.push({ index: k, price });
  }

  // Проверка пересечения
  let researchEndIndex = data.length - 1;
  let hasCrossing = false;
  
  for (let k = testPeriodDays; k < data.length; k++) {
    if (data[k].low < fullCurvePoints[k].price - 0.001) {
      researchEndIndex = k;
      hasCrossing = true;
      console.log(`⚠️ Пересечение на дне ${k + 1} - ИСПОЛЬЗУЕМ ЭТОТ ДЕНЬ ДЛЯ ВЫХОДА`);
      break;
    }
  }

  const researchDataForCalc = data.slice(testPeriodDays, researchEndIndex + 1);
  
  console.log(`\n📊 Исследуемый период: дни ${testPeriodDays + 1}-${researchEndIndex + 1} (${researchDataForCalc.length} дней)`);
  
  if (researchDataForCalc.length === 0) {
    console.log('⚠️ Исследуемый период пуст - пересечение сразу после теста');
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
      hasCrossing: hasCrossing,
      useStopLoss: useStopLoss
    };
  }

  const researchCurvePoints = fullCurvePoints.slice(testPeriodDays, researchEndIndex + 1).map((p, idx) => ({
    index: idx,
    price: p.price
  }));

  const originalEntry = parseFloat(bestCombo.testStrategy.entryPercent);
  const originalExit = parseFloat(bestCombo.testStrategy.exitPercent);
  const range = originalExit - originalEntry;
  
  const modifiedEntryPercent = parseFloat((originalEntry + range * entryMultiplier).toFixed(2));
  const modifiedExitPercent = parseFloat((originalExit - range * exitMultiplier).toFixed(2));

  console.log(`\n🔄 ПРИМЕНЯЕМ МНОЖИТЕЛИ:`);
  console.log(`   Оригинал: вход ${originalEntry}%, выход ${originalExit}%, диапазон ${range.toFixed(2)}%`);
  console.log(`   Новый вход: ${originalEntry}% + ${range.toFixed(2)}% × ${entryMultiplier} = ${modifiedEntryPercent.toFixed(2)}%`);
  console.log(`   Новый выход: ${originalExit}% - ${range.toFixed(2)}% × ${exitMultiplier} = ${modifiedExitPercent.toFixed(2)}%`);

  const researchResult = useStopLoss && bestCombo.testStrategy.stopPercent
    ? simulateTradingWithStop(researchDataForCalc, researchCurvePoints, modifiedEntryPercent, modifiedExitPercent, parseFloat(bestCombo.testStrategy.stopPercent))
    : simulateTrading(researchDataForCalc, researchCurvePoints, modifiedEntryPercent, modifiedExitPercent);
  
  const researchTradesPercent = useStopLoss
    ? (researchResult.totalTrades / researchDataForCalc.length) * 100
    : (researchResult.cleanTrades / researchDataForCalc.length) * 100;

  console.log(`\n📊 РЕЗУЛЬТАТ НА ИССЛЕДУЕМОМ ПЕРИОДЕ:`);
  console.log(`   Средний %: ${researchResult.avgPercentPerDay.toFixed(4)}%`);
  console.log(`   Трейды (чистые): ${researchResult.cleanTrades}`);
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
    researchStrategy: {
      avgPercentPerDay: parseFloat(researchResult.avgPercentPerDay.toFixed(4)),
      entryPercent: parseFloat(modifiedEntryPercent.toFixed(2)),
      exitPercent: parseFloat(modifiedExitPercent.toFixed(2)),
      stopPercent: bestCombo.testStrategy.stopPercent,
      totalTrades: researchResult.cleanTrades,
      totalDays: researchDataForCalc.length,
      hasFactClose: researchResult.hasFactClose,
      tradesPercent: parseFloat(researchTradesPercent.toFixed(2)),
      totalProfit: parseFloat(researchResult.totalProfit.toFixed(2))
    },
    researchEndIndex: researchEndIndex,
    hasCrossing: hasCrossing,
    entryMultiplier: entryMultiplier,
    exitMultiplier: exitMultiplier,
    useStopLoss: useStopLoss
  };
}