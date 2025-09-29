export function calculateSupportLine(data) {
  if (!data || data.length < 3) return null;
  
  const lows = data.map((d, i) => ({
    price: d.low,
    index: i,
    date: d.date
  }));
  
  const sortedLows = [...lows].sort((a, b) => a.price - b.price);
  const supportPoints = sortedLows.slice(0, 3);
  supportPoints.sort((a, b) => a.index - b.index);
  
  const n = supportPoints.length;
  const sumX = supportPoints.reduce((sum, p) => sum + p.index, 0);
  const sumY = supportPoints.reduce((sum, p) => sum + p.price, 0);
  const sumXY = supportPoints.reduce((sum, p) => sum + p.index * p.price, 0);
  const sumX2 = supportPoints.reduce((sum, p) => sum + p.index * p.index, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  const startPrice = intercept;
  const endPrice = intercept + slope * (data.length - 1);
  
  let touches = 0;
  data.forEach((candle, i) => {
    const linePrice = intercept + slope * i;
    if (Math.abs(candle.low - linePrice) / linePrice < 0.01) {
      touches++;
    }
  });
  
  return {
    startPrice,
    endPrice,
    slope,
    intercept,
    touches,
    points: supportPoints
  };
}