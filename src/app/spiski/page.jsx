'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SpiskiPage() {
  const router = useRouter();
  const [message, setMessage] = useState('');

  // Прямые ссылки на Finviz
  const NASDAQ_URL = "https://elite.finviz.com/export.ashx?v=152&f=exch_nasd,ind_stocksonly,sh_avgvol_o300,sh_price_3to80&auth=56d25c88-21a3-47a8-ad5a-605f01591d43";
  const NYSE_URL = "https://elite.finviz.com/export.ashx?v=152&f=exch_nyse,ind_stocksonly,sh_avgvol_o300,sh_price_3to80&auth=56d25c88-21a3-47a8-ad5a-605f01591d43";

  // Функция для открытия ссылки
  const downloadFile = (url, exchange) => {
    setMessage(`📥 Скачивание ${exchange} началось...`);
    window.open(url, '_blank');
    setTimeout(() => {
      setMessage('');
    }, 3000);
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
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-2xl w-full">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              📊 Finviz Downloader
            </h1>
            <p className="text-gray-600 text-lg">
              Скачайте данные с фондовых бирж
            </p>
          </div>
          
          {/* Кнопки */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
          
          {/* Сообщение */}
          {message && (
            <div className="mb-6 p-4 rounded-lg bg-blue-50 border-2 border-blue-200 animate-pulse">
              <p className="text-base text-blue-800 text-center font-medium">{message}</p>
            </div>
          )}
          
          {/* Информация */}
          <div className="p-6 rounded-xl bg-gradient-to-br from-gray-50 to-blue-50 border-2 border-gray-200 mb-6">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center text-lg">
              <span className="mr-2 text-2xl">ℹ️</span>
              Информация о загрузке
            </h3>
            <ul className="text-sm text-gray-700 space-y-3">
              <li className="flex items-start">
                <span className="mr-3 text-blue-500 font-bold">✓</span>
                <span><strong>Источник:</strong> Файлы скачиваются прямо с Finviz Elite</span>
              </li>
              <li className="flex items-start">
                <span className="mr-3 text-blue-500 font-bold">✓</span>
                <span><strong>Формат:</strong> CSV с данными акций</span>
              </li>
              <li className="flex items-start">
                <span className="mr-3 text-blue-500 font-bold">✓</span>
                <span><strong>Фильтры:</strong> Объем &gt; 300K, цена от $3 до $80</span>
              </li>
              <li className="flex items-start">
                <span className="mr-3 text-blue-500 font-bold">✓</span>
                <span><strong>Сохранение:</strong> Автоматически в папку "Загрузки"</span>
              </li>
            </ul>
          </div>
          
          {/* Прямые ссылки */}
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
            <p className="text-sm text-gray-600 mb-3 text-center font-medium">
              Или используйте прямые ссылки:
            </p>
            <div className="flex gap-4 justify-center">
              <a 
                href={NASDAQ_URL}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-sm font-medium transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>📊</span>
                <span>NASDAQ CSV</span>
              </a>
              <a 
                href={NYSE_URL}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-sm font-medium transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>📈</span>
                <span>NYSE CSV</span>
              </a>
            </div>
          </div>
          
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