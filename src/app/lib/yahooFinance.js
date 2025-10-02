export async function fetchStockData(ticker, startDate, endDate) {
  try {
    const params = new URLSearchParams({
      ticker,
      startDate,
      endDate
    });

    const url = `/api/stock?${params}`;
    console.log('Fetching from:', url); // <-- добавили лог
    
    const response = await fetch(url);
    console.log('Response status:', response.status); // <-- добавили лог
    
    if (!response.ok) {
      const text = await response.text();
      console.error('Error response:', text); // <-- добавили лог
      throw new Error('Failed to fetch data');
    }

    const data = await response.json();
    console.log('Got data:', data); // <-- добавили лог
    return data;
  } catch (error) {
    console.error('Error fetching stock data:', error);
    throw new Error('Не удалось получить данные для тикера ' + ticker);
  }
}