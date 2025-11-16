'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

export default function HistoryPage() {
  const router = useRouter();
  const [ticker, setTicker] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [tableData, setTableData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchStockData = async (ticker, startDate, endDate) => {
    try {
      const params = new URLSearchParams({
        ticker,
        startDate,
        endDate
      });

      const url = `/api/stock?${params}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching stock data:', error);
      throw new Error('Не удалось получить данные для тикера ' + ticker);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!ticker || !startDate || !endDate) {
        throw new Error('Заполните все поля');
      }

      if (new Date(startDate) >= new Date(endDate)) {
        throw new Error('Дата начала должна быть раньше даты конца');
      }

      const data = await fetchStockData(ticker, startDate, endDate);
      
      if (!data || data.length === 0) {
        throw new Error('Данные не найдены для указанного периода');
      }

      // Форматируем данные для таблицы
      const dates = data.map(candle => 
        new Date(candle.date).toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        })
      );

      const maxPrices = data.map(candle => candle.high.toFixed(2).replace('.', ','));
      const minPrices = data.map(candle => candle.low.toFixed(2).replace('.', ','));
      const entryPrices = data.map(candle => candle.open.toFixed(2).replace('.', ','));
      const exitPrices = data.map(candle => candle.close.toFixed(2).replace('.', ','));

      setTableData({
        ticker,
        dates,
        maxPrices,
        minPrices,
        entryPrices,
        exitPrices,
        dateRange: `${startDate} - ${endDate}`
      });
    } catch (err) {
      setError(err.message || 'Ошибка при загрузке данных');
      setTableData(null);
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = () => {
    if (!tableData) return;

    // Создаем данные для Excel
    const excelData = [
      ['Ticker Name', tableData.ticker],
      [], // Пустая строка
      ['', ...tableData.dates], // Заголовок с датами
      ['Макс цена', ...tableData.maxPrices.map(p => parseFloat(p.replace(',', '.')))],
      ['Мин цена', ...tableData.minPrices.map(p => parseFloat(p.replace(',', '.')))],
      ['Входная цена', ...tableData.entryPrices.map(p => parseFloat(p.replace(',', '.')))],
      ['Выходная цена', ...tableData.exitPrices.map(p => parseFloat(p.replace(',', '.')))]
    ];

    // Создаем рабочую книгу
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(excelData);

    // Настраиваем ширину колонок
    const cols = [{ wch: 15 }]; // Первая колонка для названий строк
    for (let i = 0; i < tableData.dates.length; i++) {
      cols.push({ wch: 12 }); // Колонки для дат
    }
    ws['!cols'] = cols;

    // Форматируем ячейки с ценами как числа с запятой
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = 3; R <= 6; R++) { // Строки с ценами (Макс, Мин, Входная, Выходная)
      for (let C = 1; C <= range.e.c; C++) { // Все колонки с данными
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        if (ws[cellAddress] && typeof ws[cellAddress].v === 'number') {
          ws[cellAddress].z = '#,##0.00'; // Формат числа с двумя знаками после запятой
          ws[cellAddress].t = 'n'; // Тип - число
        }
      }
    }

    // Добавляем лист в книгу
    XLSX.utils.book_append_sheet(wb, ws, 'История');

    // Скачиваем файл
    XLSX.writeFile(wb, `${tableData.ticker}_история_${Date.now()}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Навигационная шапка */}
      <div className="bg-white shadow-md border-b border-gray-200">
        <div className="flex gap-4 p-4">
          <button 
            onClick={() => router.push('/levelup')}
            className="px-8 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-full font-medium transition-colors"
          >
            Level Up
          </button>
          <button 
            onClick={() => router.push('/leveldown')}
            className="px-8 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-full font-medium transition-colors"
          >
            Level Down
          </button>
          <button 
            onClick={() => router.push('/level1')}
            className="px-8 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-full font-medium transition-colors"
          >
            Level 1
          </button>
          <button 
            onClick={() => router.push('/level2')}
            className="px-8 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-full font-medium transition-colors"
          >
            Level 2
          </button>
          <button 
            className="px-8 py-3 bg-indigo-500 text-white rounded-full font-medium shadow-lg"
          >
            История
          </button>
        </div>
      </div>

      <div className="flex">
        <div className="w-80 bg-[#7A8B9A] min-h-screen p-6">
          <h2 className="text-white text-xl font-semibold mb-4">Исторические данные</h2>
          <p className="text-white/80 text-sm mb-6">Таблица с ценами акций</p>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              placeholder="тикер"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              className="w-full px-4 py-2 rounded-lg bg-gray-200 text-gray-800 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />

            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-gray-200 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />

            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-gray-200 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2 rounded-lg text-white font-medium transition-colors ${
                loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-500 hover:bg-indigo-600'
              }`}
            >
              {loading ? 'Загрузка...' : 'Показать таблицу'}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="mt-8 text-white/80 text-sm">
            <p className="font-medium mb-2">Популярные тикеры:</p>
            <div className="space-y-1">
              {['MSFT', 'AAPL', 'GOOGL', 'TSLA'].map(t => (
                <button
                  key={t}
                  onClick={() => setTicker(t)}
                  className="block hover:text-white transition-colors"
                >
                  • {t}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 p-4 bg-white/10 rounded-lg text-white/80 text-xs">
            <p className="font-semibold mb-2">Содержимое таблицы:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Даты - в заголовках столбцов</li>
              <li>Макс цена - максимум дня</li>
              <li>Мин цена - минимум дня</li>
              <li>Входная цена - цена открытия</li>
              <li>Выходная цена - цена закрытия</li>
            </ul>
          </div>
        </div>

        <div className="flex-1 p-8">
          <div className="bg-white rounded-2xl shadow-xl p-6 min-h-[600px]">
            {!tableData && !loading && (
              <div className="flex items-center justify-center h-[500px]">
                <div className="text-center">
                  <p className="text-gray-500 text-lg">Введите данные для формирования таблицы</p>
                  <p className="text-gray-400 text-sm mt-2">с историческими ценами акций</p>
                </div>
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center h-[500px]">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
                  <p className="text-gray-500 mt-4">Загрузка данных...</p>
                </div>
              </div>
            )}

            {tableData && !loading && (
              <div className="flex items-center justify-center h-[500px]">
                <div className="text-center">
                  <div className="text-6xl mb-4">✅</div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-4">
                    Данные готовы!
                  </h3>
                  <p className="text-gray-600 mb-2">
                    <strong>Тикер:</strong> {tableData.ticker}
                  </p>
                  <p className="text-gray-600 mb-6">
                    <strong>Период:</strong> {tableData.dateRange}
                  </p>
                  <p className="text-gray-600 mb-6">
                    <strong>Всего дней:</strong> {tableData.dates.length}
                  </p>
                  <button
                    onClick={downloadExcel}
                    className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 mx-auto text-lg shadow-lg"
                  >
                    📥 Скачать Excel
                  </button>
                  <p className="text-sm text-gray-500 mt-4">
                    Файл будет содержать таблицу с датами и ценами
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}