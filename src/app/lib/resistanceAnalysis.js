export function calculateResistanceLine(data) {
  if (!data || data.length < 2) return null;
  
  // Находим абсолютный максимум
  let absoluteMaxIndex = 0;
  let absoluteMaxPrice = data[0].high;
  
  data.forEach((candle, i) => {
    if (candle.high > absoluteMaxPrice) {
      absoluteMaxPrice = candle.high;
      absoluteMaxIndex = i;
    }
  });
  
  // Ищем все максимумы справа от абсолютного
  const candidatesRight = [];
  for (let i = absoluteMaxIndex + 1; i < data.length; i++) {
    candidatesRight.push({
      index: i,
      price: data[i].high,
      date: data[i].date
    });
  }
  
  // Если справа нет точек, ищем слева
  const candidatesLeft = [];
  if (candidatesRight.length === 0) {
    for (let i = 0; i < absoluteMaxIndex; i++) {
      candidatesLeft.push({
        index: i,
        price: data[i].high,
        date: data[i].date
      });
    }
  }
  
  const candidates = candidatesRight.length > 0 ? candidatesRight : candidatesLeft;
  if (candidates.length === 0) return null;
  
  const point1 = {
    index: absoluteMaxIndex,
    price: absoluteMaxPrice,
    date: data[absoluteMaxIndex].date
  };
  
  // Пробуем найти вторую точку, чтобы линия прошла выше всех свечей
  let bestPoint2 = null;
  let bestSlope = null;
  let bestIntercept = null;
  
  for (const candidate of candidates) {
    const slope = (candidate.price - point1.price) / (candidate.index - point1.index);
    const intercept = point1.price - slope * point1.index;
    
    // Проверяем, что линия проходит выше всех свечей
    let isValid = true;
    let maxViolation = 0;
    
    for (let i = 0; i < data.length; i++) {
      const linePrice = intercept + slope * i;
      const violation = data[i].high - linePrice;
      
      if (violation > 0.001) { // если линия ниже свечи
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
  
  // Если не нашли подходящую точку, берем ближайший максимум и сдвигаем линию вверх
  if (!bestPoint2) {
    // Сортируем кандидатов по цене (в обратном порядке)
    candidates.sort((a, b) => b.price - a.price);
    bestPoint2 = candidates[0];
    
    const slope = (bestPoint2.price - point1.price) / (bestPoint2.index - point1.index);
    let intercept = point1.price - slope * point1.index;
    
    // Находим максимальное нарушение
    let maxViolation = 0;
    for (let i = 0; i < data.length; i++) {
      const linePrice = intercept + slope * i;
      const violation = data[i].high - linePrice;
      if (violation > maxViolation) {
        maxViolation = violation;
      }
    }
    
    // Сдвигаем линию вверх
    intercept += (maxViolation + 0.5); // добавляем отступ
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
    const diff = Math.abs(candle.high - linePrice);
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