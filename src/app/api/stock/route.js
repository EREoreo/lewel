import { NextResponse } from 'next/server';

// Massive.com API endpoint (бывший Polygon.io)
const MASSIVE_API_URL = 'https://api.massive.com/v2';

// Функция для получения API ключа
function getApiKey() {
  const apiKey = process.env.MASSIVE_API_KEY;
  if (!apiKey) {
    throw new Error('MASSIVE_API_KEY not found in environment variables');
  }
  return apiKey;
}

// Функция для получения исторических данных через Massive.com
async function getHistoricalData(ticker, startDate, endDate) {
  const apiKey = getApiKey();
  
  // Massive.com использует формат YYYY-MM-DD
  const start = new Date(startDate).toISOString().split('T')[0];
  const end = new Date(endDate).toISOString().split('T')[0];
  
  // Massive API: Aggregates (bars) endpoint
  // /v2/aggs/ticker/{ticker}/range/{multiplier}/{timespan}/{from}/{to}
  const url = `${MASSIVE_API_URL}/aggs/ticker/${ticker}/range/1/day/${start}/${end}?adjusted=true&sort=asc&limit=50000&apiKey=${apiKey}`;
  
  console.log('📡 Massive.com Request:', { ticker, start, end });
  
  const response = await fetch(url);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Massive.com API Error:', errorText);
    throw new Error(`Massive.com API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  // Проверяем статус ответа
  if (data.status === 'ERROR') {
    console.error('❌ Massive.com returned error:', data.error);
    throw new Error(`Massive.com error: ${data.error}`);
  }
  
  if (!data.results || data.results.length === 0) {
    console.log('⚠️ No data available for this ticker/period');
    return [];
  }
  
  // Преобразуем данные Massive.com в формат Yahoo Finance
  // Massive возвращает: { v: volume, vw: vwap, o: open, c: close, h: high, l: low, t: timestamp, n: transactions }
  const quotes = data.results.map(bar => ({
    date: new Date(bar.t), // Unix timestamp (миллисекунды) -> Date
    open: bar.o,
    high: bar.h,
    low: bar.l,
    close: bar.c,
    volume: bar.v
  }));
  
  console.log(`✅ Loaded ${quotes.length} data points from Massive.com`);
  
  return quotes;
}

export async function GET(request) {
  const searchParams = request.nextUrl.searchParams;
  const ticker = searchParams.get('ticker');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  console.log('📊 API called with:', { ticker, startDate, endDate });

  if (!ticker || !startDate || !endDate) {
    return NextResponse.json(
      { error: 'Missing required parameters' },
      { status: 400 }
    );
  }

  try {
    // Преобразуем даты
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Добавляем 1 день к конечной дате (как в оригинале)
    end.setDate(end.getDate() + 1);

    const data = await getHistoricalData(ticker, start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
    
    console.log(`✅ Returning ${data.length} candles`);
    if (data.length > 0) {
      console.log('📅 Date range:', data[0]?.date, '-', data[data.length - 1]?.date);
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ Error fetching stock data:', error);
    return NextResponse.json(
      { error: `Failed to fetch data for ticker ${ticker}: ${error.message}` },
      { status: 500 }
    );
  }
}