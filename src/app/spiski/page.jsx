'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SpiskiPage() {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Прямые ссылки на Finviz
  const NASDAQ_URL = "https://elite.finviz.com/export.ashx?v=152&f=exch_nasd,ind_stocksonly,sh_avgvol_o300,sh_price_3to80&auth=56d25c88-21a3-47a8-ad5a-605f01591d43";
  const NYSE_URL = "https://elite.finviz.com/export.ashx?v=152&f=exch_nyse,ind_stocksonly,sh_avgvol_o300,sh_price_3to80&auth=56d25c88-21a3-47a8-ad5a-605f01591d43";

  // СПИСОК ИСКЛЮЧЕНИЙ - эти тикеры будут удалены из файла
  const EXCLUDED_TICKERS = new Set([
    // Первая группа
    'ARX', 'BLSH', 'FN', 'NU', 'COPL', 'MSC', 'PUK', 'AVAL', 'CIB', 'EC', 'GPRK', 'TGLS', 
    'ACN', 'AER', 'ALLE', 'AON', 'DOLE', 'ETN', 'JCI', 'HAK', 'MDT', 'PRGO', 'STE', 'SW', 
    'TEL', 'TT', 'CMDB', 'CMRE', 'NMM', 'SB', 'STNG', 'AEG', 'ING', 'JBS', 'PRG', 'QGEN', 
    'STLA', 'ZEPP', 'BLX', 'CPA', 'PHI', 'BBVA', 'SAN', 'TEF', 'WBX', 'AU', 'BCS', 'BIRK', 
    'BP', 'BTI', 'BG', 'CLCO', 'CLVT', 'CNH', 'CPRI', 'CUK', 'CWK', 'DAVA', 'DEO', 'EVTL', 
    'GENI', 'GSK', 'HLN', 'HSBC', 'IHG', 'IHS', 'JHG', 'KLAR', 'KNOP', 'LYB', 'LYG', 'MANU', 
    'NGG', 'NOMD', 'NVGS', 'NVT', 'NWG', 'PNR', 'PSFE', 'PSO', 'RDY', 'RIO', 'RTO', 'SGHC', 
    'SHCO', 'SHEL', 'SNP', 'UL', 'VTEX', 'WPP',
    // Вторая группа
    'OSW', 'BGL', 'GET', 'GRACU', 'GRDO', 'GVCO', 'FERA', 'GLBE', 'KWM', 'NAMM', 'OXBR', 
    'PAX', 'SELX', 'STNE', 'ABTS', 'ACCL', 'AGMH', 'AMPA', 'APAD', 'ASPC', 'ATGL', 'AURE', 
    'AXG', 'BMHB', 'BGAA', 'BULU', 'CCTG', 'CGTL', 'CHHR', 'CJJT', 'CLIK', 'CLPS', 'CLWT', 
    'CSE', 'DKI', 'FEBO', 'FIEE', 'FUFU', 'GIBO', 'GLE', 'GLXG', 'GBAN', 'GSIW', 'HQM', 
    'HIPO', 'IFBD', 'ILAG', 'ILMN', 'INDH', 'INTJ', 'JL', 'JXJT', 'MATH', 'MHB', 'MCTA', 
    'MGRT', 'MESL', 'MTRY', 'MIGH', 'MUMI', 'MLCO', 'MHGY', 'MSW', 'MTC', 'NCEW', 'NCI', 
    'NCT', 'NHTC', 'OCG', 'ONEG', 'PHOE', 'PMAX', 'PRE', 'PSIG', 'RAY', 'RGC', 'RITR', 
    'ROMA', 'SFHG', 'SIMO', 'SKBL', 'SLGB', 'SOPA', 'SUGP', 'TDIC', 'TROO', 'TWG', 'UCL', 
    'VSME', 'WGT', 'WTF', 'YBNA', 'ZDAI', 'ADSE', 'ALKS', 'AMRN', 'AVDL', 'CMPR', 'CREV', 
    'GHRS', 'HTOO', 'ICLS', 'ITRM', 'JAMZ', 'MURA', 'PRTA', 'RAAAY', 'SMMT', 'SMX', 'STER', 
    'AGRZ', 'ALPS', 'ATPC', 'BAUL', 'BGLC', 'BTTC', 'COHN', 'FGL', 'GRMQ', 'GTI', 'IMTE', 
    'LNHS', 'MGIN', 'SAFT', 'VCIG', 'WFF', 'ARGX', 'ASML', 'ATAI', 'CNCK', 'FER', 'LVTX', 
    'MRUS', 'NAMS', 'NBIS', 'NKP', 'PHAR', 'PHVS', 'PROR', 'QURE', 'VDDL', 'GRFS', 'TUBR', 
    'AFBI', 'AKAN', 'APM', 'ARBK', 'ARM', 'ARQQ', 'ATZN', 'AUTL', 'AXIN', 'AZN', 'BCPC', 
    'BDRX', 'BRNC', 'CAPT', 'CDEP', 'CHPS', 'CHTA', 'CRML', 'DGNW', 'DYCQ', 'ECX', 'ENGS', 
    'GSKR', 'GRFN', 'INGR', 'IYKC', 'LIN', 'LIVN', 'MREO', 'MRNW', 'MRNO', 'MRX', 'NCNA', 
    'NVCR', 'OKYO', 'RCT', 'RQIV', 'RZLV', 'SUN', 'SMTK', 'TLSA', 'TRMD', 'UOIKA', 'VOD', 
    'VRAX', 'VVPR', 'WSHP', 'WTW'
  ]);

  // Функция для открытия ссылки на скачивание
  const downloadFile = (url, exchange) => {
    setMessage(`📥 Скачивание ${exchange} началось... После скачивания загрузите файл для фильтрации!`);
    window.open(url, '_blank');
    setTimeout(() => {
      setMessage('');
    }, 5000);
  };

  // Обработчик загрузки файла
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadedFile(file);
      setMessage(`✅ Файл "${file.name}" загружен. Нажмите "Фильтровать" для обработки.`);
    }
  };

  // Функция фильтрации CSV
  const filterCSV = async () => {
    if (!uploadedFile) {
      setMessage('❌ Пожалуйста, загрузите CSV файл');
      return;
    }

    setProcessing(true);
    setMessage('⏳ Обработка файла...');

    try {
      // Читаем файл
      const text = await uploadedFile.text();
      const lines = text.split('\n');
      
      if (lines.length === 0) {
        throw new Error('Файл пустой');
      }

      // Первая строка - заголовок
      const header = lines[0];
      const filteredLines = [header];
      
      let totalTickers = 0;
      let excludedCount = 0;

      // Обрабатываем каждую строку
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue; // Пропускаем пустые строки
        
        totalTickers++;
        
        // Первая колонка - это тикер
        const ticker = line.split(',')[0].trim().toUpperCase();
        
        // Проверяем, не в списке ли исключений
        if (!EXCLUDED_TICKERS.has(ticker)) {
          filteredLines.push(line);
        } else {
          excludedCount++;
          console.log(`❌ Исключен: ${ticker}`);
        }
      }

      // Создаем новый CSV
      const filteredCSV = filteredLines.join('\n');
      
      // Скачиваем результат
      const blob = new Blob([filteredCSV], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `filtered_${uploadedFile.name}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setMessage(`✅ Готово! Удалено ${excludedCount} из ${totalTickers} тикеров. Осталось: ${totalTickers - excludedCount}`);
      setUploadedFile(null);
      
    } catch (error) {
      console.error('Ошибка обработки файла:', error);
      setMessage('❌ Ошибка при обработке файла: ' + error.message);
    } finally {
      setProcessing(false);
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
            className="px-8 py-3 bg-gradient-to-r from-blue-500 to-green-500 text-white rounded-full font-medium shadow-lg"
          >
            Списки
          </button>
        </div>
      </div>

      {/* Основной контент */}
      <div className="flex items-center justify-center min-h-[calc(100vh-100px)] p-6">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-3xl w-full">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              📊 Finviz с Фильтрацией
            </h1>
            <p className="text-gray-600 text-lg">
              Скачайте данные и отфильтруйте нежелательные тикеры
            </p>
          </div>

          {/* ШАГ 1: Скачать с Finviz */}
          <div className="mb-8 p-6 bg-blue-50 rounded-xl border-2 border-blue-200">
            <h2 className="text-xl font-bold text-blue-900 mb-4 flex items-center">
              <span className="text-3xl mr-3">1️⃣</span>
              Шаг 1: Скачайте CSV с Finviz
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => downloadFile(NASDAQ_URL, 'NASDAQ')}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-6 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                <div className="flex flex-col items-center space-y-2">
                  <span className="text-4xl">🇺🇸</span>
                  <span className="text-xl">NASDAQ</span>
                  <span className="text-sm opacity-90">Технологические компании</span>
                </div>
              </button>
              
              <button
                onClick={() => downloadFile(NYSE_URL, 'NYSE')}
                className="bg-green-500 hover:bg-green-600 text-white font-bold py-6 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                <div className="flex flex-col items-center space-y-2">
                  <span className="text-4xl">📈</span>
                  <span className="text-xl">NYSE</span>
                  <span className="text-sm opacity-90">Нью-Йоркская биржа</span>
                </div>
              </button>
            </div>
          </div>

          {/* ШАГ 2: Загрузить и отфильтровать */}
          <div className="mb-6 p-6 bg-green-50 rounded-xl border-2 border-green-200">
            <h2 className="text-xl font-bold text-green-900 mb-4 flex items-center">
              <span className="text-3xl mr-3">2️⃣</span>
              Шаг 2: Загрузите CSV для фильтрации
            </h2>
            
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="flex-1">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="w-full px-4 py-3 bg-white border-2 border-green-300 rounded-lg text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 cursor-pointer"
                  />
                </label>
                
                <button
                  onClick={filterCSV}
                  disabled={!uploadedFile || processing}
                  className={`px-8 py-3 rounded-lg font-bold text-white transition-all ${
                    !uploadedFile || processing
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-lg hover:shadow-xl'
                  }`}
                >
                  {processing ? '⏳ Фильтрация...' : '🔍 Фильтровать'}
                </button>
              </div>
              
              {uploadedFile && (
                <div className="p-3 bg-white rounded-lg border border-green-300">
                  <p className="text-sm text-green-800">
                    <strong>Файл:</strong> {uploadedFile.name} ({(uploadedFile.size / 1024).toFixed(2)} KB)
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {/* Сообщение */}
          {message && (
            <div className="mb-6 p-4 rounded-lg bg-blue-50 border-2 border-blue-200 animate-pulse">
              <p className="text-base text-blue-800 font-medium">{message}</p>
            </div>
          )}
          
          {/* Информация */}
          <div className="p-6 rounded-xl bg-gradient-to-br from-gray-50 to-purple-50 border-2 border-gray-200 mb-6">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center text-lg">
              <span className="mr-2 text-2xl">ℹ️</span>
              Как это работает
            </h3>
            <ul className="text-sm text-gray-700 space-y-3">
              <li className="flex items-start">
                <span className="mr-3 text-blue-500 font-bold">1.</span>
                <span>Скачайте CSV файл с NASDAQ или NYSE, нажав на кнопку выше</span>
              </li>
              <li className="flex items-start">
                <span className="mr-3 text-blue-500 font-bold">2.</span>
                <span>Загрузите скачанный CSV файл в форму</span>
              </li>
              <li className="flex items-start">
                <span className="mr-3 text-blue-500 font-bold">3.</span>
                <span>Нажмите "Фильтровать" - система автоматически удалит <strong>{EXCLUDED_TICKERS.size} нежелательных тикеров</strong></span>
              </li>
              <li className="flex items-start">
                <span className="mr-3 text-blue-500 font-bold">4.</span>
                <span>Отфильтрованный файл автоматически скачается на ваш компьютер</span>
              </li>
            </ul>
          </div>

          {/* Список исключений (свернутый) */}
          <details className="p-4 rounded-xl bg-red-50 border border-red-200">
            <summary className="font-bold text-red-900 cursor-pointer mb-2">
              🚫 Список исключенных тикеров ({EXCLUDED_TICKERS.size} шт.)
            </summary>
            <div className="mt-3 p-3 bg-white rounded-lg text-xs text-gray-700 max-h-40 overflow-y-auto">
              {Array.from(EXCLUDED_TICKERS).sort().join(', ')}
            </div>
          </details>
          
          {/* Статус */}
          <div className="mt-6 text-center">
            <div className="inline-flex items-center space-x-2 px-4 py-2 bg-green-50 border border-green-200 rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-green-700 font-medium">Готов к работе</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}