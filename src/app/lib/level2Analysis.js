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

  for (let entryPercent = 0.3; entryPercent <= 30.0; entryPercent += 0.1) {
    for (let exitPercent = entryPercent + 0.3; exitPercent <= 30.0; exitPercent += 0.1) {
      
      const minResistancePrice = Math.min(...curvePoints.map(p => p.price));
      const exitPrice = minResistancePrice * (1 - exitPercent / 100);
      
      if (exitPrice < localMin) {
        break;
      }

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

// Симуляция торговли - ТОЧНО КАК В EXCEL!
function simulateTrading(data, curvePoints, entryPercent, exitPercent) {
  let totalProfit = 0;
  let totalTrades = 0;
  let state = 0; // 0 = нет позиции, 1 = в позиции, 2 = только что закрыли
  let savedEntryPrice = 0; // G25 - сохраненная цена входа

  for (let i = 0; i < data.length; i++) {
    const candle = data[i];
    const resistancePrice = curvePoints[i].price;
    
    // H22 - цена входа (маркер выход)
    const entryPrice = resistancePrice * (1 - entryPercent / 100);
    // H24 - цена выхода (маркер цена входа) 
    const exitPriceTarget = resistancePrice * (1 - exitPercent / 100);

    // H21 - условие входа: IF((H20*(1-$B$3/100))<H6,1,0)
    const canEnter = candle.high >= entryPrice;
    // H23 - условие выхода: IF((H20*(1-$B$4/100))>H7,1,0)
    const canExit = candle.low <= exitPriceTarget;

    // H26 - машина состояний: =H10*IF(OR(G26=0,G26=2),H21,G26+H23)
    if (state === 0 || state === 2) {
      // Нет позиции или только что закрыли
      if (canEnter) {
        state = 1;
        savedEntryPrice = entryPrice; // H25 - сохраняем цену входа
        totalTrades++;
      } else if (state === 2) {
        state = 0;
      }
    } else if (state === 1) {
      // В позиции - проверяем выход
      if (canExit) {
        // H29 - расчет прибыли: =IF(H26=2,(G25/H24-1)*100,0)
        // G25 - сохраненная цена входа (из предыдущего дня = текущая)
        // H24 - цена выхода
        const profit = (savedEntryPrice / exitPriceTarget - 1) * 100;
        totalProfit += profit;
        state = 2;
        
        // Проверяем можем ли войти снова в этот же день
        if (canEnter) {
          state = 1;
          savedEntryPrice = entryPrice;
          totalTrades++;
        } else {
          state = 0;
        }
      }
    }
    
    // H30 - если последний день и в позиции: =IF(AND(H26=1,I10=0),((H25/H9)-1)*100,0)
    if (i === data.length - 1 && state === 1) {
      // H9 - выходная цена (берем close как в оригинале)
      const profit = (savedEntryPrice / candle.close - 1) * 100;
      totalProfit += profit;
    }
  }

  const avgPercentPerDay = totalProfit / data.length;

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