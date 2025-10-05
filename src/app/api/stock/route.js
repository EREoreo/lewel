import yahooFinance from 'yahoo-finance2';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const searchParams = request.nextUrl.searchParams;
  const ticker = searchParams.get('ticker');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  console.log('API called with:', { ticker, startDate, endDate });

  if (!ticker || !startDate || !endDate) {
    return NextResponse.json(
      { error: 'Missing required parameters' },
      { status: 400 }
    );
  }

  try {
    // Преобразуем даты в объекты Date
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Вычитаем 1 день из начальной даты
    start.setDate(start.getDate() );
    
    // Добавляем 1 день к конечной дате
    end.setDate(end.getDate() + 1);

    const result = await yahooFinance.chart(ticker, {
      period1: start,
      period2: end,
      interval: '1d'
    });
    
    const data = result.quotes.map(quote => ({
      date: quote.date,
      open: quote.open,
      high: quote.high,
      low: quote.low,
      close: quote.close,
      volume: quote.volume
    }));

    console.log('Returning data, length:', data.length);
    console.log('Date range:', data[0]?.date, '-', data[data.length - 1]?.date);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching stock data:', error);
    return NextResponse.json(
      { error: `Failed to fetch data for ticker ${ticker}` },
      { status: 500 }
    );
  }
}