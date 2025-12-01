// Симуляция торговли - ТОЧНО КАК В EXCEL!
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

// ОСНОВНАЯ ФУНКЦИЯ - для одиночной обработки БЕЗ тестового периода
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

// НОВАЯ функция с полным перебором комбинаций и выбором лучшей по схожести
export function calculateExponentialResistanceLineWithTest(data, testPeriodDays, point1MaxDay = null, point2MinDay = null, minTradesPercent = 0) {
  if (!data || data.length < 2) return null;
  if (testPeriodDays >= data.length) {
    return calculateExponentialResistanceLine(data, point1MaxDay, point2MinDay, minTradesPercent);
  }

  console.log('\n🔬 НАЧАЛО ПОИСКА ЛУЧШЕЙ КОМБИНАЦИИ (LEVEL 2)');
  console.log(`Тестовый участок: дни 1-${testPeriodDays}`);
  console.log(`Исследуемый участок: дни ${testPeriodDays + 1}-${data.length}`);
  console.log(`Фильтры: точка1≤${point1MaxDay || 'любой'}, точка2≥${point2MinDay || 'любой'}, %сделок≥${minTradesPercent}%`);

  const testData = data.slice(0, testPeriodDays);

  // 1. НАХОДИМ ВСЕ ВОЗМОЖНЫЕ КОМБИНАЦИИ ТОЧЕК НА ТЕСТОВОМ УЧАСТКЕ
  const allCombinations = [];
  
  for (let i = 0; i < testData.length; i++) {
    // Проверка фильтра для точки 1
    if (point1MaxDay !== null && i > point1MaxDay - 1) continue;
    
    for (let j = i + 1; j < testData.length; j++) {
      // Проверка фильтра для точки 2
      if (point2MinDay !== null) {
        const minAllowedIndex = testData.length - point2MinDay;
        if (j < minAllowedIndex) continue;
      }
      
      const n = j - i;
      const percentPerDay = Math.pow(testData[j].high / testData[i].high, 1 / n);
      
      // Проверяем, что линия проходит выше всех свечей на тестовом участке
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

  // 2. ПЕРЕБИРАЕМ ВСЕ СТРАТЕГИИ ДЛЯ КАЖДОЙ КОМБИНАЦИИ
  let bestCombination = null;
  let maxSimilarity = -Infinity;
  let totalChecked = 0;
  let passedFilters = 0;

  for (const combo of allCombinations) {
    let localMin = Infinity;
    testData.forEach(candle => {
      if (candle.low < localMin) localMin = candle.low;
    });

    for (let entryPercent = 0.3; entryPercent <= 30.0; entryPercent += 0.1) {
      for (let exitPercent = entryPercent + 0.3; exitPercent <= 30.0; exitPercent += 0.1) {
        totalChecked++;
        
        const minResistancePrice = Math.min(...combo.testCurvePoints.map(p => p.price));
        const exitPrice = minResistancePrice * (1 - exitPercent / 100);
        if (exitPrice < localMin) break;

        // ТЕСТ
        const testResult = simulateTrading(testData, combo.testCurvePoints, entryPercent, exitPercent, false);
        const testTradesPercent = (testResult.cleanTrades / testData.length) * 100;
        
        if (testTradesPercent < minTradesPercent) continue;

        // ИССЛЕДОВАНИЕ
        const fullCurvePoints = [];
        for (let k = 0; k < data.length; k++) {
          const price = combo.point1Price * Math.pow(combo.percentPerDay, k - combo.point1Index);
          fullCurvePoints.push({ index: k, price });
        }

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
        if (researchDataForCalc.length === 0) continue;

        const researchCurvePoints = fullCurvePoints.slice(testPeriodDays, researchEndIndex + 1).map((p, idx) => ({
          index: idx,
          price: p.price
        }));

        const researchResult = simulateTrading(researchDataForCalc, researchCurvePoints, entryPercent, exitPercent, false);
        const researchTradesPercent = (researchResult.cleanTrades / researchDataForCalc.length) * 100;

        // ФИЛЬТР
        if (researchTradesPercent < minTradesPercent) continue;

        passedFilters++;

        // РАСЧЕТ СХОЖЕСТИ
        const testAvg = testResult.avgPercentPerDay;
        const researchAvg = researchResult.avgPercentPerDay;
        const similarity = testAvg !== 0 ? (researchAvg / testAvg) * 100 : 0;

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