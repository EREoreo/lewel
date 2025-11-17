// Функция для оптимизации стратегии торговли
function optimizeLevel2TradingStrategy(data, curvePoints) {
  if (!data || data.length < 2 || !curvePoints) return null;

  let localMin = Infinity;
  data.forEach(candle => {
    if (candle.low < localMin) {
      localMin = candle.low;
    }
  });

  let bestStrategy = null;
  let maxAvgPercentPerDay = -Infinity;

  console.log('\n🔍 НАЧАЛО ОПТИМИЗАЦИИ СТРАТЕГИИ LEVEL 2 (SHORT)');
  console.log(`Перебор комбинаций ENTER% и EXIT%...`);
  
  let totalCombinations = 0;
  let validCombinations = 0;

  for (let entryPercent = 0.3; entryPercent <= 30.0; entryPercent += 0.1) {
    for (let exitPercent = entryPercent + 0.3; exitPercent <= 30.0; exitPercent += 0.1) {
      totalCombinations++;
      
      const minResistancePrice = Math.min(...curvePoints.map(p => p.price));
      const exitPrice = minResistancePrice * (1 - exitPercent / 100);
      
      if (exitPrice < localMin) {
        break;
      }

      // verbose=false при оптимизации, чтобы не засорять консоль
      const result = simulateTrading(data, curvePoints, entryPercent, exitPercent, false);
      validCombinations++;
      
      if (result && result.avgPercentPerDay > maxAvgPercentPerDay) {
        maxAvgPercentPerDay = result.avgPercentPerDay;
        bestStrategy = {
          entryPercent: entryPercent.toFixed(1),
          exitPercent: exitPercent.toFixed(1),
          avgPercentPerDay: result.avgPercentPerDay.toFixed(4),
          totalTrades: result.totalTrades,
          totalProfit: result.totalProfit.toFixed(2)
        };
        
        // Логируем новый рекорд
        console.log(`✨ Новый лучший результат: ENTER=${entryPercent.toFixed(1)}%, EXIT=${exitPercent.toFixed(1)}% → ${result.avgPercentPerDay.toFixed(4)}% в день`);
      }
    }
  }

  console.log(`\n📊 Оптимизация завершена!`);
  console.log(`Проверено комбинаций: ${totalCombinations}`);
  console.log(`Валидных комбинаций: ${validCombinations}`);
  
  if (bestStrategy) {
    console.log(`\n🏆 ОПТИМАЛЬНАЯ СТРАТЕГИЯ:`);
    console.log(`   ENTER%: ${bestStrategy.entryPercent}%`);
    console.log(`   EXIT%: ${bestStrategy.exitPercent}%`);
    console.log(`   Средний % в день: ${bestStrategy.avgPercentPerDay}%`);
    console.log(`   Всего сделок: ${bestStrategy.totalTrades}`);
    console.log(`   Общая прибыль: ${bestStrategy.totalProfit}%`);
    
    // Запускаем финальную симуляцию с детальным логом
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📝 ДЕТАЛЬНЫЙ РАЗБОР ОПТИМАЛЬНОЙ СТРАТЕГИИ:`);
    console.log(`${'='.repeat(60)}`);
    simulateTrading(data, curvePoints, parseFloat(bestStrategy.entryPercent), parseFloat(bestStrategy.exitPercent), true);
  }

  return bestStrategy;
}

// Симуляция торговли - ТОЧНО КАК В EXCEL!
// verbose = true: детальный лог каждой сделки
// verbose = false: только итоговая статистика
function simulateTrading(data, curvePoints, entryPercent, exitPercent, verbose = false) {
  let totalProfit = 0;
  let totalTrades = 0;
  let state = 0; // 0 = нет позиции, 1 = в позиции, 2 = только что закрыли
  let savedEntryPrice = 0; // G25 - сохраненная цена входа из предыдущего дня
  let prevSavedEntryPrice = 0; // Для хранения цены входа из предыдущего дня
  let tradeEntryDay = -1; // День входа в позицию для отслеживания

  for (let i = 0; i < data.length; i++) {
    const candle = data[i];
    const resistancePrice = curvePoints[i].price;
    const dateStr = new Date(candle.date).toLocaleDateString('ru-RU');
    
    // H22 - цена входа для шорта (продаем когда цена падает от уровня)
    const entryPrice = resistancePrice * (1 - entryPercent / 100);
    // H24 - цена выхода (выкуп SHORT позиции) 
    const exitPriceTarget = resistancePrice * (1 - exitPercent / 100);

    // H21 - условие входа: IF((H20*(1-$B$3/100))<H6,1,0)
    // Входим в SHORT когда high МЕНЬШЕ цены входа (цена упала)
    const canEnter = entryPrice < candle.high;
    
    // H23 - условие выхода: IF((H20*(1-$B$4/100))>H7,1,0)
    // Выходим из SHORT когда exitPrice БОЛЬШЕ low (цена упала еще ниже для выкупа)
    const canExit = exitPriceTarget > candle.low;

    // Сохраняем предыдущее значение savedEntryPrice перед обновлением
    prevSavedEntryPrice = savedEntryPrice;

    // H26 - машина состояний: =H10*IF(OR(G26=0,G26=2),H21,G26+H23)
    if (state === 0 || state === 2) {
      // Нет позиции или только что закрыли
      if (canEnter) {
        state = 1;
        savedEntryPrice = entryPrice; // H25 - сохраняем цену входа
        totalTrades++;
        tradeEntryDay = i;
        
        if (verbose) {
          // 📈 НАЧАЛО СДЕЛКИ (ВХОД В SHORT)
          console.log(`\n🔴 ВХОД В SHORT #${totalTrades}`);
          console.log(`   День: ${i + 1} (${dateStr})`);
          console.log(`   Цена продажи: $${entryPrice.toFixed(2)}`);
          console.log(`   Уровень сопротивления: $${resistancePrice.toFixed(2)}`);
          console.log(`   High дня: $${candle.high.toFixed(2)}, Low: $${candle.low.toFixed(2)}`);
        }
      } else if (state === 2) {
        state = 0;
        savedEntryPrice = 0;
      }
    } else if (state === 1) {
      // В позиции - проверяем выход
      if (canExit) {
        // H29 - расчет прибыли: =IF(H26=2,(G25/H24-1)*100,0)
        // G25 - сохраненная цена входа из ПРЕДЫДУЩЕГО дня (prevSavedEntryPrice)
        // H24 - цена выхода
        const profit = (prevSavedEntryPrice / exitPriceTarget - 1) * 100;
        totalProfit += profit;
        const daysInTrade = i - tradeEntryDay;
        
        if (verbose) {
          // 📉 КОНЕЦ СДЕЛКИ (ВЫХОД ИЗ SHORT)
          console.log(`\n🟢 ВЫХОД ИЗ SHORT #${totalTrades}`);
          console.log(`   День: ${i + 1} (${dateStr})`);
          console.log(`   Цена выкупа: $${exitPriceTarget.toFixed(2)}`);
          console.log(`   Цена продажи была: $${prevSavedEntryPrice.toFixed(2)} (день ${tradeEntryDay + 1})`);
          console.log(`   Дней в позиции: ${daysInTrade}`);
          console.log(`   💰 ПРИБЫЛЬ: ${profit.toFixed(2)}%`);
          console.log(`   📊 Общая прибыль: ${totalProfit.toFixed(2)}%`);
        }
        
        // Переходим в состояние 2 (только что закрыли)
        // В Excel: G26=2 → в следующий день H26 проверит H21 (можем ли войти)
        state = 2;
        savedEntryPrice = 0;
      }
      // Если не вышли, сохраняем цену входа для следующего дня
    }
    
    // H30 - если последний день и в позиции: =IF(AND(H26=1,I10=0),((H25/H9)-1)*100,0)
    if (i === data.length - 1 && state === 1) {
      // H9 - выходная цена (берем close)
      const profit = (savedEntryPrice / candle.close - 1) * 100;
      totalProfit += profit;
      const daysInTrade = i - tradeEntryDay;
      
      if (verbose) {
        // 🏁 ПРИНУДИТЕЛЬНОЕ ЗАКРЫТИЕ В ПОСЛЕДНИЙ ДЕНЬ
        console.log(`\n⚠️ ПРИНУДИТЕЛЬНОЕ ЗАКРЫТИЕ ПОЗИЦИИ (последний день)`);
        console.log(`   День: ${i + 1} (${dateStr})`);
        console.log(`   Цена выкупа (close): $${candle.close.toFixed(2)}`);
        console.log(`   Цена продажи была: $${savedEntryPrice.toFixed(2)} (день ${tradeEntryDay + 1})`);
        console.log(`   Дней в позиции: ${daysInTrade}`);
        console.log(`   💰 ПРИБЫЛЬ: ${profit.toFixed(2)}%`);
        console.log(`   📊 Общая прибыль: ${totalProfit.toFixed(2)}%`);
      }
    }
  }

  const avgPercentPerDay = totalProfit / data.length;

  if (verbose) {
    // 📊 ИТОГОВАЯ СТАТИСТИКА
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 ИТОГОВАЯ СТАТИСТИКА`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Параметры: ENTER=${entryPercent.toFixed(1)}%, EXIT=${exitPercent.toFixed(1)}%`);
    console.log(`Всего дней: ${data.length}`);
    console.log(`Всего сделок: ${totalTrades}`);
    console.log(`Общая прибыль: ${totalProfit.toFixed(2)}%`);
    console.log(`Средний % в день: ${avgPercentPerDay.toFixed(4)}%`);
    console.log(`${'='.repeat(60)}\n`);
  }

  return {
    avgPercentPerDay,
    totalTrades,
    totalProfit
  };
}

export function calculateExponentialResistanceLine(data) {
  if (!data || data.length < 2) return null;
  
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
  
  const candidatesRight = [];
  for (let i = absoluteMaxIndex + 1; i < data.length; i++) {
    candidatesRight.push({
      index: i,
      price: data[i].high,
      date: data[i].date
    });
  }
  
  if (candidatesRight.length === 0) return null;
  
  let minPercentPerDay = Infinity;
  let bestPoint2 = null;
  let bestCurveParams = null;
  
  for (const candidate of candidatesRight) {
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
  
  if (!bestPoint2) return null;
  
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
  
  const tradingStrategy = optimizeLevel2TradingStrategy(data, curvePoints);
  
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