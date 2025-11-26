'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Level2Chart from '../components/Level2Chart';
import { fetchStockData } from '../lib/yahooFinance';

export default function Level2Page() {
  const router = useRouter();
  
  // Одиночный режим
  const [ticker, setTicker] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Массовый режим
  const [selectedFile, setSelectedFile] = useState(null);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [mode, setMode] = useState('single');

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setError('');
    }
  };

  const handleBatchProcess = async () => {
    if (!selectedFile || !startDate || !endDate) {
      setError('Выберите файл и укажите даты');
      return;
    }

    setBatchProcessing(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('startDate', startDate);
      formData.append('endDate', endDate);
      formData.append('analysisType', 'level2');

      const response = await fetch('/api/batch', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Ошибка при обработке файла');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `level2_results_${new Date().getTime()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      alert('✅ Файл успешно обработан и скачан!');
    } catch (err) {
      setError(err.message || 'Ошибка при обработке файла');
    } finally {
      setBatchProcessing(false);
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

      setChartData(data);
    } catch (err) {
      setError(err.message || 'Ошибка при загрузке данных');
      setChartData(null);
    } finally {
      setLoading(false);
    }
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
            className="px-8 py-3 bg-orange-500 text-white rounded-full font-medium shadow-lg"
          >
            Level 2 (Exp. Resistance)
          </button>
          <button
            onClick={() => router.push('/history')}
            className="px-8 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-full font-medium transition-colors"
          >
            История
          </button>
          <button
            onClick={() => router.push('/spiski')}
            className="px-8 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-full font-medium transition-colors"
          >
            Списки
          </button>
        </div>
      </div>

      <div className="flex">
        <div className="w-80 bg-[#9A7A7A] min-h-screen p-6">
          <h2 className="text-white text-xl font-semibold mb-4">Level 2 Analysis</h2>
          <p className="text-white/80 text-sm mb-6">Экспоненциальная линия сопротивления</p>
          
          {/* Переключатель режимов */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setMode('single')}
              className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                mode === 'single'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Один тикер
            </button>
            <button
              onClick={() => setMode('batch')}
              className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                mode === 'batch'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Массовая
            </button>
            
          </div>

          {mode === 'single' ? (
            /* Форма для одного тикера */
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="text"
                placeholder="тикер"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                className="w-full px-4 py-2 rounded-lg bg-gray-200 text-gray-800 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-400"
              />

              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-gray-200 text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
              />

              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-gray-200 text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
              />

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-2 rounded-lg text-white font-medium transition-colors ${
                  loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600'
                }`}
              >
                {loading ? 'Загрузка...' : 'Построить график'}
              </button>
            </form>
          ) : (
            /* Форма для массовой обработки */
            <div className="space-y-4">
              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Загрузить Excel файл
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="w-full px-4 py-2 rounded-lg bg-gray-200 text-gray-800 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
                />
                {selectedFile && (
                  <p className="text-white text-xs mt-2">
                    ✓ {selectedFile.name}
                  </p>
                )}
              </div>

              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-gray-200 text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
              />

              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-gray-200 text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
              />

              <button
                onClick={handleBatchProcess}
                disabled={batchProcessing}
                className={`w-full py-2 rounded-lg text-white font-medium transition-colors ${
                  batchProcessing ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {batchProcessing ? 'Обработка...' : '🚀 Обработать файл'}
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="mt-8 text-white/80 text-sm">
            <p className="font-medium mb-2">Популярные тикеры:</p>
            <div className="space-y-1">
              {['INTC', 'BABA', 'COIN', 'RIVN'].map(t => (
                <button
                  key={t}
                  onClick={() => {
                    setMode('single');
                    setTicker(t);
                  }}
                  className="block hover:text-white transition-colors"
                >
                  • {t}
                </button>
              ))}
            </div>
          </div>

          {mode === 'batch' && (
            <div className="mt-8 p-4 bg-white/10 rounded-lg text-white/80 text-xs">
              <p className="font-semibold mb-2">📝 Формат Excel:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Первый столбец - тикеры</li>
                <li>Результат включает процент</li>
                <li>Автоматическое скачивание</li>
              </ul>
            </div>
          )}

          <div className="mt-8 p-4 bg-white/10 rounded-lg text-white/80 text-xs">
            <p className="font-semibold mb-2">Особенности Level 2:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Изогнутая экспоненциальная линия</li>
              <li>Максимальный процент падения в день</li>
              <li>Проходит выше всех свечей</li>
              <li>Для анализа падающих акций</li>
            </ul>
          </div>
        </div>

        <div className="flex-1 p-8">
          <div className="bg-white rounded-2xl shadow-xl p-6 min-h-[600px]">
            {!chartData && !loading && mode === 'single' && (
              <div className="flex items-center justify-center h-[500px]">
                <div className="text-center">
                  <p className="text-gray-500 text-lg">Введите данные для построения графика</p>
                  <p className="text-gray-400 text-sm mt-2">с экспоненциальной линией сопротивления</p>
                </div>
              </div>
            )}

            {mode === 'batch' && (
              <div className="flex items-center justify-center h-[500px]">
                <div className="text-center max-w-md">
                  <div className="text-6xl mb-4">📉</div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-4">Массовая обработка Level 2</h3>
                  <p className="text-gray-600 mb-6">
                    Загрузите Excel файл с тикерами и получите экспоненциальные линии сопротивления для падающих акций.
                  </p>
                  <div className="bg-orange-50 p-4 rounded-lg text-sm text-left">
                    <p className="font-semibold text-orange-900 mb-2">Результат будет содержать:</p>
                    <ul className="space-y-1 text-orange-700">
                      <li>• Тикер</li>
                      <li>• Цена точки 1</li>
                      <li>• Цена точки 2</li>
                      <li>• Номер дня 1</li>
                      <li>• Номер дня 2</li>
                      <li>• Процент падения в день</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {loading && (
              <div className="flex items-center justify-center h-[500px]">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
                  <p className="text-gray-500 mt-4">Загрузка данных...</p>
                </div>
              </div>
            )}

            {chartData && !loading && mode === 'single' && (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-gray-800">
                    {ticker} - График с экспоненциальной линией сопротивления
                  </h3>
                  <div className="text-sm text-gray-600">
                    {startDate} - {endDate}
                  </div>
                </div>
                <Level2Chart data={chartData} ticker={ticker} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}