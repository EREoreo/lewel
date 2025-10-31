export function calculateExponentialSupportLine(data) {
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
    const diff = Math.abs(candle.low - curvePrice);
    if (diff < 0.5) { // если разница меньше 50 центов
      touches++;
    }
  });
  
  return {
    points: [point1, bestPoint2],
    curvePoints: curvePoints,
    percentPerDay: bestCurveParams.percentPerDay,
    percentPerDayPercent: ((bestCurveParams.percentPerDay - 1) * 100).toFixed(4), // в процентах
    touches: Math.max(touches, 2),
    startPrice: curvePoints[0].price,
    endPrice: curvePoints[curvePoints.length - 1].price
  };
}