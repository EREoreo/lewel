import yahooFinance from 'yahoo-finance2';

export async function fetchStockData(ticker, startDate, endDate) {
  try {
    const result = await yahooFinance.chart(ticker, {
      period1: startDate,
      period2: endDate,
      interval: '1d'
    });
    
    return result.quotes.map(quote => ({
      date: quote.date,
      open: quote.open,
      high: quote.high,
      low: quote.low,
      close: quote.close,
      volume: quote.volume
    }));
  } catch (error) {
    console.error('Error fetching stock data:', error);
    throw new Error('Не удалось получить данные для тикера ' + ticker);
  }
}