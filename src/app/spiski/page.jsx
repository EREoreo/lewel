'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SpiskiPage() {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [excludedFile, setExcludedFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [excludedCount, setExcludedCount] = useState(0);

  // Обработчик загрузки Excel файла с запрещенными тикерами
  const handleExcludedFileUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setExcludedFile(file);
      
      // Парсим файл для подсчета тикеров
      try {
        const XLSX = await import('xlsx');
        const arrayBuffer = await file.arrayBuffer();
        
        // ВАЖНО: Указываем тип 'array' и игнорируем ошибки сжатия
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { 
          type: 'array',
          cellDates: true,
          cellStyles: false,
          // Добавляем опции для обработки проблемных файлов
          WTF: false  // Отключаем строгую проверку
        });
        
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        
        // Считаем тикеры (пропускаем заголовок)
        let count = 0;
        for (let i = 1; i < data.length; i++) {
          if (data[i][0]) count++;
        }
        
        setExcludedCount(count);
        setMessage(`✅ Файл "${file.name}" загружен. Найдено ${count} запрещенных тикеров. Теперь выберите биржу для скачивания.`);
      } catch (error) {
        console.error('Ошибка чтения файла:', error);
        setExcludedFile(file); // Все равно сохраняем файл
        setMessage(`⚠️ Файл "${file.name}" загружен. Не удалось подсчитать тикеры (${error.message}), но можно продолжать - сервер обработает файл.`);
      }
    }
  };

  // Функция скачивания отфильтрованного списка
  const downloadFilteredList = async (exchange) => {
    if (!excludedFile) {
      setMessage('❌ Сначала загрузите файл с запрещенными тикерами!');
      return;
    }

    setProcessing(true);
    setMessage(`⏳ Скачиваю данные с Finviz (${exchange.toUpperCase()}) и фильтрую...`);

    try {
      const formData = new FormData();
      formData.append('excludedFile', excludedFile);
      formData.append('exchange', exchange);

      const response = await fetch('/api/filter-finviz', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Ошибка сервера');
      }

      // Скачиваем файл
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `filtered_${exchange}_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setMessage(`✅ Файл ${exchange.toUpperCase()} успешно скачан и отфильтрован!`);
      
    } catch (error) {
      console.error('Ошибка:', error);
      setMessage('❌ Ошибка: ' + error.message);
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
              Загрузите список запрещенных тикеров и скачайте отфильтрованные данные
            </p>
          </div>

          {/* ШАГ 1: Загрузить Excel с запрещенными тикерами */}
          <div className="mb-8 p-6 bg-purple-50 rounded-xl border-2 border-purple-200">
            <h2 className="text-xl font-bold text-purple-900 mb-4 flex items-center">
              <span className="text-3xl mr-3">1️⃣</span>
              Шаг 1: Загрузите Excel с запрещенными тикерами
            </h2>
            
            <div className="space-y-4">
              <label className="block">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleExcludedFileUpload}
                  className="w-full px-4 py-3 bg-white border-2 border-purple-300 rounded-lg text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 cursor-pointer"
                />
              </label>
              
              {excludedFile && (
                <div className="p-4 bg-white rounded-lg border border-purple-300">
                  <p className="text-sm text-purple-800 font-medium">
                    <strong>✅ Файл загружен:</strong> {excludedFile.name}
                  </p>
                  {excludedCount > 0 && (
                    <p className="text-sm text-purple-600 mt-2">
                      🚫 Запрещенных тикеров: <strong>{excludedCount}</strong>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ШАГ 2: Скачать отфильтрованный список */}
          <div className="mb-6 p-6 bg-blue-50 rounded-xl border-2 border-blue-200">
            <h2 className="text-xl font-bold text-blue-900 mb-4 flex items-center">
              <span className="text-3xl mr-3">2️⃣</span>
              Шаг 2: Скачайте отфильтрованный список с Finviz
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => downloadFilteredList('nasdaq')}
                disabled={!excludedFile || processing}
                className={`font-bold py-6 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg ${
                  !excludedFile || processing
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600 text-white hover:shadow-xl'
                }`}
              >
                <div className="flex flex-col items-center space-y-2">
                  <span className="text-4xl">🇺🇸</span>
                  <span className="text-xl">NASDAQ</span>
                  <span className="text-sm opacity-90">Технологические компании</span>
                </div>
              </button>
              
              <button
                onClick={() => downloadFilteredList('nyse')}
                disabled={!excludedFile || processing}
                className={`font-bold py-6 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg ${
                  !excludedFile || processing
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-500 hover:bg-green-600 text-white hover:shadow-xl'
                }`}
              >
                <div className="flex flex-col items-center space-y-2">
                  <span className="text-4xl">📈</span>
                  <span className="text-xl">NYSE</span>
                  <span className="text-sm opacity-90">Нью-Йоркская биржа</span>
                </div>
              </button>
            </div>
          </div>
          
          {/* Сообщение */}
          {message && (
            <div className={`mb-6 p-4 rounded-lg border-2 ${
              message.includes('❌') 
                ? 'bg-red-50 border-red-200' 
                : message.includes('⏳')
                ? 'bg-yellow-50 border-yellow-200 animate-pulse'
                : 'bg-green-50 border-green-200'
            }`}>
              <p className={`text-base font-medium ${
                message.includes('❌')
                  ? 'text-red-800'
                  : message.includes('⏳')
                  ? 'text-yellow-800'
                  : 'text-green-800'
              }`}>{message}</p>
            </div>
          )}
          
          {/* Информация */}
          <div className="p-6 rounded-xl bg-gradient-to-br from-gray-50 to-indigo-50 border-2 border-gray-200">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center text-lg">
              <span className="mr-2 text-2xl">ℹ️</span>
              Как это работает
            </h3>
            <ul className="text-sm text-gray-700 space-y-3">
              <li className="flex items-start">
                <span className="mr-3 text-blue-500 font-bold">1.</span>
                <span>Загрузите Excel файл со списком запрещенных тикеров (первая колонка должна содержать тикеры)</span>
              </li>
              <li className="flex items-start">
                <span className="mr-3 text-blue-500 font-bold">2.</span>
                <span>Выберите биржу (NASDAQ или NYSE) для скачивания</span>
              </li>
              <li className="flex items-start">
                <span className="mr-3 text-blue-500 font-bold">3.</span>
                <span>Система автоматически загрузит данные с Finviz, отфильтрует запрещенные тикеры и скачает готовый CSV файл</span>
              </li>
              <li className="flex items-start">
                <span className="mr-3 text-blue-500 font-bold">4.</span>
                <span>Используйте полученный файл для дальнейшего анализа</span>
              </li>
            </ul>
          </div>
          
          {/* Статус */}
          <div className="mt-6 text-center">
            <div className="inline-flex items-center space-x-2 px-4 py-2 bg-green-50 border border-green-200 rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-green-700 font-medium">
                {excludedFile ? 'Готов к скачиванию' : 'Ожидание загрузки файла'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}