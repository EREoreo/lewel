'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Level2Chart from '../components/Level2Chart';
import { fetchStockData } from '../lib/yahooFinance';

export default function Level2Page() {
  const router = useRouter();
  
  const getInitialState = () => {
    if (typeof window === 'undefined') return '';
    try {
      const saved = localStorage.getItem('level2_state');
      if (saved) {
        const state = JSON.parse(saved);
        console.log('📥 Начальная загрузка Level 1:', state);
        return state;
      }
    } catch (error) {
      console.error('❌ Ошибка загрузки:', error);
    }
    return null;
  };

  const initialState = getInitialState();
  
  const [ticker, setTicker] = useState(initialState?.ticker || '');
  const [startDate, setStartDate] = useState(initialState?.startDate || '');
  const [endDate, setEndDate] = useState(initialState?.endDate || '');
  const [testPeriodDays, setTestPeriodDays] = useState(initialState?.testPeriodDays || '');
  const [point1MaxDay, setPoint1MaxDay] = useState(initialState?.point1MaxDay || '');
  const [point2MinDay, setPoint2MinDay] = useState(initialState?.point2MinDay || '');
  const [minTradesPercent, setMinTradesPercent] = useState(initialState?.minTradesPercent || '');
  const [batchTestPeriodDays, setBatchTestPeriodDays] = useState(initialState?.batchTestPeriodDays || '');
  
  const [entryMultiplier, setEntryMultiplier] = useState(initialState?.entryMultiplier || '0');
  const [exitMultiplier, setExitMultiplier] = useState(initialState?.exitMultiplier || '0');
  const [batchEntryMultiplier, setBatchEntryMultiplier] = useState(initialState?.batchEntryMultiplier || '0');
  const [batchExitMultiplier, setBatchExitMultiplier] = useState(initialState?.batchExitMultiplier || '0');
  
  // 🆕 СТОП-ЛОСС
  const [stopLossPercent, setStopLossPercent] = useState(initialState?.stopLossPercent || '3.5');
  const [useStopLoss, setUseStopLoss] = useState(initialState?.useStopLoss || false);
  const [batchStopLossPercent, setBatchStopLossPercent] = useState(initialState?.batchStopLossPercent || '3.5');
  const [batchUseStopLoss, setBatchUseStopLoss] = useState(initialState?.batchUseStopLoss || false);
  
  const [mode, setMode] = useState('single');
  
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [selectedFile, setSelectedFile] = useState(null);
  const [batchProcessing, setBatchProcessing] = useState(false);

  useEffect(() => {
    if (initialState?.mode) {
      setMode(initialState.mode);
    }
  }, []);

  useEffect(() => {
    const state = {
      ticker,
      startDate,
      endDate,
      testPeriodDays,
      point1MaxDay,
      point2MinDay,
      minTradesPercent,
      batchTestPeriodDays,
      entryMultiplier,
      exitMultiplier,
      batchEntryMultiplier,
      batchExitMultiplier,
      stopLossPercent,
      useStopLoss,
      batchStopLossPercent,
      batchUseStopLoss,
      mode
    };
    
    try {
      localStorage.setItem('level2_state', JSON.stringify(state));
      console.log('💾 Level 1 сохранено:', state);
    } catch (error) {
      console.error('❌ Ошибка сохранения:', error);
    }
  }, [ticker, startDate, endDate, testPeriodDays, point1MaxDay, point2MinDay, minTradesPercent, 
      batchTestPeriodDays, entryMultiplier, exitMultiplier, batchEntryMultiplier, batchExitMultiplier,
      stopLossPercent, useStopLoss, batchStopLossPercent, batchUseStopLoss, mode]);

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
      
      if (point1MaxDay) formData.append('point1MaxDay', point1MaxDay);
      if (point2MinDay) formData.append('point2MinDay', point2MinDay);
      if (minTradesPercent) formData.append('minTradesPercent', minTradesPercent);
      
      if (batchTestPeriodDays) {
        formData.append('testPeriodDays', batchTestPeriodDays);
      }
      
      if (batchEntryMultiplier) {
        formData.append('entryMultiplier', batchEntryMultiplier);
      }
      if (batchExitMultiplier) {
        formData.append('exitMultiplier', batchExitMultiplier);
      }
      
      // 🆕 СТОП-ЛОСС
      if (batchUseStopLoss) {
        formData.append('useStopLoss', 'true');
        formData.append('manualStopPercent', batchStopLossPercent);
      }

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

      if (testPeriodDays && parseInt(testPeriodDays) >= data.length) {
        throw new Error(`Тестовый период (${testPeriodDays} дней) должен быть меньше общего количества дней (${data.length})`);
      }
      
      if (point1MaxDay && parseInt(point1MaxDay) > data.length) {
        throw new Error(`Точка 1 до дня (${point1MaxDay}) не может быть больше общего количества дней (${data.length})`);
      }
      
      if (point2MinDay && parseInt(point2MinDay) > data.length) {
        throw new Error(`Точка 2 от дня (${point2MinDay}) не может быть больше общего количества дней (${data.length})`);
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
            className="px-8 py-3 bg-orange-500 text-white rounded-full font-medium shadow-lg"
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
        <div className="w-80 bg-[#9A7A7A] min-h-screen p-6 overflow-y-auto">
          <h2 className="text-white text-xl font-semibold mb-4">Level 1 Analysis</h2>
          <p className="text-white/80 text-sm mb-6">Экспоненциальная линия поддержки</p>
          
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
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text"
                placeholder="Тикер"
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

              <div className="relative">
                <label className="block text-white text-sm font-medium mb-2">
                  Тестовый период (дней)
                  <span className="text-white/60 text-xs ml-2">необязательно</span>
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="пусто = обычный режим"
                  value={testPeriodDays}
                  onChange={(e) => setTestPeriodDays(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-gray-200 text-gray-800 placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>

              <div className="border-t border-white/20 pt-3 mt-3">
                <p className="text-white text-xs font-semibold mb-3">🔢 Множители уровней</p>
                
                <div className="relative mb-3">
                  <label className="block text-white text-xs font-medium mb-1">
                    Множитель для входа (0-10)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.01"
                    placeholder="0 (без сдвига)"
                    value={entryMultiplier}
                    onChange={(e) => setEntryMultiplier(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-gray-200 text-gray-800 placeholder-gray-500 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>

                <div className="relative">
                  <label className="block text-white text-xs font-medium mb-1">
                    Множитель для выхода (0-10)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.01"
                    placeholder="0 (без сдвига)"
                    value={exitMultiplier}
                    onChange={(e) => setExitMultiplier(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-gray-200 text-gray-800 placeholder-gray-500 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>

              {/* 🆕 СТОП-ЛОСС */}
              <div className="border-t border-white/20 pt-3 mt-3">
                <label className="flex items-center text-white text-sm mb-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useStopLoss}
                    onChange={(e) => setUseStopLoss(e.target.checked)}
                    className="mr-2 w-4 h-4 cursor-pointer"
                  />
                  <span className="font-medium">🛑 Использовать стоп-лосс</span>
                </label>
                
                {useStopLoss && (
                  <div className="ml-6 space-y-2">
                    <label className="block text-white text-xs font-medium mb-1">
                      Стоп-лосс (%)
                    </label>
                    <input
                      type="number"
                      min="0.1"
                      max="20"
                      step="0.1"
                      value={stopLossPercent}
                      onChange={(e) => setStopLossPercent(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-gray-200 text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                      placeholder="3.5"
                    />
                    <p className="text-white/60 text-xs">
                      Стоп на {stopLossPercent}% выше линии сопротивления
                    </p>
                  </div>
                )}
                
                {!useStopLoss && (
                  <p className="text-white/70 text-xs ml-6">
                    Без стопа: выход только по цели или в конце периода
                  </p>
                )}
              </div>

              <div className="border-t border-white/20 pt-3 mt-3">
                <p className="text-white text-xs font-semibold mb-3">🎯 Фильтры точек</p>
                
                <div className="relative mb-3">
                  <label className="block text-white text-xs font-medium mb-1">
                    Точка 1 до дня
                    <span className="text-white/60 text-xs ml-2">необязательно</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="напр. 10 (точка 1 в днях 1-10)"
                    value={point1MaxDay}
                    onChange={(e) => setPoint1MaxDay(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-gray-200 text-gray-800 placeholder-gray-500 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>

                <div className="relative mb-3">
                  <label className="block text-white text-xs font-medium mb-1">
                    Точка 2 от конца (дней)
                    <span className="text-white/60 text-xs ml-2">необязательно</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="напр. 3 (точка 2 в последних 3 днях)"
                    value={point2MinDay}
                    onChange={(e) => setPoint2MinDay(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-gray-200 text-gray-800 placeholder-gray-500 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>

                <div className="relative">
                  <label className="block text-white text-xs font-medium mb-1">
                    Мин. процент сделок (%)
                    <span className="text-white/60 text-xs ml-2">необязательно</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder="напр. 15 (15% сделок минимум)"
                    value={minTradesPercent}
                    onChange={(e) => setMinTradesPercent(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-gray-200 text-gray-800 placeholder-gray-500 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>

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
            <div className="space-y-3">
              <div>
                <label className="block text-white text-sm font-medium mb-2">
                  Загрузить Excel файл
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="w-full px-4 py-2 rounded-lg bg-gray-200 text-gray-800 text-xs file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
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

              <div className="border-t border-white/20 pt-3">
                <p className="text-white text-xs font-semibold mb-3">📅 Разделение периода</p>
                
                <input
                  type="number"
                  min="1"
                  placeholder="Тестовый период (дней)"
                  value={batchTestPeriodDays}
                  onChange={(e) => setBatchTestPeriodDays(e.target.value)}
                  className="w-full px-3 py-2 mb-2 rounded-lg bg-gray-200 text-gray-800 placeholder-gray-600 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>

              <div className="border-t border-white/20 pt-3 mt-3">
                <p className="text-white text-xs font-semibold mb-3">🔢 Множители уровней</p>
                
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.01"
                  placeholder="Множитель входа (0)"
                  value={batchEntryMultiplier}
                  onChange={(e) => setBatchEntryMultiplier(e.target.value)}
                  className="w-full px-3 py-2 mb-2 rounded-lg bg-gray-200 text-gray-800 placeholder-gray-600 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400"
                />

                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.01"
                  placeholder="Множитель выхода (0)"
                  value={batchExitMultiplier}
                  onChange={(e) => setBatchExitMultiplier(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-gray-200 text-gray-800 placeholder-gray-600 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>

              {/* 🆕 СТОП-ЛОСС ДЛЯ МАССОВОЙ */}
              <div className="border-t border-white/20 pt-3 mt-3">
                <label className="flex items-center text-white text-sm mb-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={batchUseStopLoss}
                    onChange={(e) => setBatchUseStopLoss(e.target.checked)}
                    className="mr-2 w-4 h-4 cursor-pointer"
                  />
                  <span className="font-medium">🛑 Использовать стоп-лосс</span>
                </label>
                
                {batchUseStopLoss && (
                  <div className="ml-6">
                    <label className="block text-white text-xs font-medium mb-1">
                      Стоп-лосс (%)
                    </label>
                    <input
                      type="number"
                      min="0.1"
                      max="20"
                      step="0.1"
                      value={batchStopLossPercent}
                      onChange={(e) => setBatchStopLossPercent(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-gray-200 text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                      placeholder="3.5"
                    />
                    <p className="text-white/60 text-xs mt-1">
                      от уровня сопротивления
                    </p>
                  </div>
                )}
              </div>

              <div className="border-t border-white/20 pt-3">
                <p className="text-white text-xs font-semibold mb-3">🎯 Фильтры (необязательно)</p>
                
                <input
                  type="number"
                  min="1"
                  placeholder="Точка 1 до дня"
                  value={point1MaxDay}
                  onChange={(e) => setPoint1MaxDay(e.target.value)}
                  className="w-full px-3 py-2 mb-2 rounded-lg bg-gray-200 text-gray-800 placeholder-gray-600 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400"
                />

                <input
                  type="number"
                  min="1"
                  placeholder="Точка 2 от конца (дней)"
                  value={point2MinDay}
                  onChange={(e) => setPoint2MinDay(e.target.value)}
                  className="w-full px-3 py-2 mb-2 rounded-lg bg-gray-200 text-gray-800 placeholder-gray-600 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400"
                />

                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="Мин. процент сделок (%)"
                  value={minTradesPercent}
                  onChange={(e) => setMinTradesPercent(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-gray-200 text-gray-800 placeholder-gray-600 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>

              <button
                onClick={handleBatchProcess}
                disabled={batchProcessing}
                className={`w-full py-2 rounded-lg text-white font-medium transition-colors ${
                  batchProcessing ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
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

          <div className="mt-6 text-white/80 text-xs">
            <p className="font-medium mb-2">Популярные тикеры:</p>
            <div className="space-y-1">
              {['MSFT', 'AAPL', 'GOOGL', 'TSLA'].map(t => (
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

          <div className="mt-6 p-3 bg-white/10 rounded-lg text-white/80 text-xs">
            <p className="font-semibold mb-2">🆕 Новые возможности:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Стоп-лосс: защита от больших убытков</li>
              <li>Тестовый период: разделение данных</li>
              <li>Множители: настройка уровней</li>
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
                  <div className="text-6xl mb-4">📈</div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-4">Массовая обработка Level 1</h3>
                  <p className="text-gray-600 mb-6">
                    Загрузите Excel файл с тикерами и получите экспоненциальные линии сопротивления.
                  </p>
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
                    {useStopLoss && (
                      <div className="text-xs text-red-600 mt-1">
                        Стоп-лосс: {stopLossPercent}%
                      </div>
                    )}
                  </div>
                </div>
                <Level2Chart 
                  data={chartData} 
                  ticker={ticker} 
                  testPeriodDays={testPeriodDays ? parseInt(testPeriodDays) : null}
                  point1MaxDay={point1MaxDay ? parseInt(point1MaxDay) : null}
                  point2MinDay={point2MinDay ? parseInt(point2MinDay) : null}
                  minTradesPercent={minTradesPercent ? parseFloat(minTradesPercent) : 0}
                  entryMultiplier={entryMultiplier ? parseFloat(entryMultiplier) : 0}
                  exitMultiplier={exitMultiplier ? parseFloat(exitMultiplier) : 0}
                  useStopLoss={useStopLoss}
                  manualStopPercent={useStopLoss ? parseFloat(stopLossPercent) : null}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}