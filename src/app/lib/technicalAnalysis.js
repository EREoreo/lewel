export function calculateSupportLine(data) {
  if (!data || data.length < 2) return null;
  
  // Находим абсолютный минимум
  let absoluteMinIndex = 0;
  let absoluteMinPrice = data[0].low;
  
  data.forEach((candle, i) => {
    if (candle.low < absoluteMinPrice) {
      absoluteMinPrice = candle.low;
      absoluteMinIndex = i;
    }
  });
  
  // Ищем все минимумы справа от абсолютного
  const candidatesRight = [];
  for (let i = absoluteMinIndex + 1; i < data.length; i++) {
    candidatesRight.push({
      index: i,
      price: data[i].low,
      date: data[i].date
    });
  }
  
  // Если справа нет точек, ищем слева
  const candidatesLeft = [];
  if (candidatesRight.length === 0) {
    for (let i = 0; i < absoluteMinIndex; i++) {
      candidatesLeft.push({
        index: i,
        price: data[i].low,
        date: data[i].date
      });
    }
  }
  
  const candidates = candidatesRight.length > 0 ? candidatesRight : candidatesLeft;
  if (candidates.length === 0) return null;
  
  const point1 = {
    index: absoluteMinIndex,
    price: absoluteMinPrice,
    date: data[absoluteMinIndex].date
  };
  
  // Пробуем найти вторую точку, чтобы линия прошла ниже всех свечей
  let bestPoint2 = null;
  let bestSlope = null;
  let bestIntercept = null;
  
  for (const candidate of candidates) {
    const slope = (candidate.price - point1.price) / (candidate.index - point1.index);
    const intercept = point1.price - slope * point1.index;
    
    // Проверяем, что линия проходит ниже всех свечей
    let isValid = true;
    let maxViolation = 0;
    
    for (let i = 0; i < data.length; i++) {
      const linePrice = intercept + slope * i;
      const violation = linePrice - data[i].low;
      
      if (violation > 0.001) { // если линия выше свечи
        maxViolation = Math.max(maxViolation, violation);
        isValid = false;
      }
    }
    
    if (isValid) {
      bestPoint2 = candidate;
      bestSlope = slope;
      bestIntercept = intercept;
      break;
    }
  }
  
  // Если не нашли подходящую точку, берем ближайший минимум и сдвигаем линию вниз
  if (!bestPoint2) {
    // Сортируем кандидатов по цене
    candidates.sort((a, b) => a.price - b.price);
    bestPoint2 = candidates[0];
    
    const slope = (bestPoint2.price - point1.price) / (bestPoint2.index - point1.index);
    let intercept = point1.price - slope * point1.index;
    
    // Находим максимальное нарушение
    let maxViolation = 0;
    for (let i = 0; i < data.length; i++) {
      const linePrice = intercept + slope * i;
      const violation = linePrice - data[i].low;
      if (violation > maxViolation) {
        maxViolation = violation;
      }
    }
    
    // Сдвигаем линию вниз
    intercept -= (maxViolation + 0.5); // добавляем отступ
    bestSlope = slope;
    bestIntercept = intercept;
  }
  
  // Упорядочиваем точки слева направо
  const points = [point1, bestPoint2].sort((a, b) => a.index - b.index);
  
  const startPrice = bestIntercept;
  const endPrice = bestIntercept + bestSlope * (data.length - 1);
  
  // Считаем касания
  let touches = 0;
  data.forEach((candle, i) => {
    const linePrice = bestIntercept + bestSlope * i;
    const diff = Math.abs(candle.low - linePrice);
    if (diff < 0.5) { // если разница меньше 50 центов
      touches++;
    }
  });
  
  return {
    startPrice,
    endPrice,
    slope: bestSlope,
    intercept: bestIntercept,
    touches: Math.max(touches, 2),
    points: points
  };
}