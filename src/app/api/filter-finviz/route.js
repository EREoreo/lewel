import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const excludedFile = formData.get('excludedFile'); // Excel с запрещенными тикерами
    const exchange = formData.get('exchange'); // 'nasdaq' или 'nyse'

    if (!excludedFile) {
      return NextResponse.json(
        { error: 'Файл с запрещенными тикерами не загружен' },
        { status: 400 }
      );
    }

    // Читаем Excel с запрещенными тикерами
    const excludedBytes = await excludedFile.arrayBuffer();
    const excludedBuffer = Buffer.from(excludedBytes);
    
    // ВАЖНО: Добавляем опции для корректного чтения
    const excludedWorkbook = XLSX.read(excludedBuffer, { 
      type: 'buffer',
      cellDates: true,
      cellStyles: false,
      WTF: false  // Отключаем строгую проверку для проблемных файлов
    });
    
    const excludedSheet = excludedWorkbook.Sheets[excludedWorkbook.SheetNames[0]];
    const excludedData = XLSX.utils.sheet_to_json(excludedSheet, { header: 1 });

    // Собираем список запрещенных тикеров (первая колонка, пропускаем заголовок)
    const excludedTickers = new Set();
    for (let i = 1; i < excludedData.length; i++) {
      if (excludedData[i][0]) {
        const ticker = String(excludedData[i][0]).trim().toUpperCase();
        excludedTickers.add(ticker);
      }
    }

    console.log(`📋 Загружено ${excludedTickers.size} запрещенных тикеров`);

    // URL для Finviz
    const FINVIZ_URLS = {
      nasdaq: "https://elite.finviz.com/export.ashx?v=151&f=exch_nasd%2Cind_stocksonly%2Csh_avgvol_o300%2Csh_price_3to80&c=1&auth=56d25c88-21a3-47a8-ad5a-605f01591d43",
      nyse: "https://elite.finviz.com/export.ashx?v=151&f=exch_nyse%2Cind_stocksonly%2Csh_avgvol_o300%2Csh_price_3to80&c=1&auth=56d25c88-21a3-47a8-ad5a-605f01591d43"
    };

    const finvizUrl = FINVIZ_URLS[exchange];
    if (!finvizUrl) {
      return NextResponse.json(
        { error: 'Неверная биржа' },
        { status: 400 }
      );
    }

    // Скачиваем данные с Finviz
    console.log(`📥 Скачиваю данные с Finviz (${exchange.toUpperCase()})...`);
    const finvizResponse = await fetch(finvizUrl);
    
    if (!finvizResponse.ok) {
      throw new Error('Не удалось получить данные с Finviz');
    }

    const csvText = await finvizResponse.text();
    const lines = csvText.split('\n');
    
    if (lines.length === 0) {
      throw new Error('Finviz вернул пустой файл');
    }

    // Фильтруем данные
    const header = lines[0];
    const filteredLines = [header];
    
    let totalTickers = 0;
    let excludedCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      totalTickers++;
      
      // Первая колонка - это тикер
      const ticker = line.split(',')[0].trim().toUpperCase();
      
      if (!excludedTickers.has(ticker)) {
        filteredLines.push(line);
      } else {
        excludedCount++;
        console.log(`❌ Исключен: ${ticker}`);
      }
    }

    const filteredCSV = filteredLines.join('\n');
    
    console.log(`✅ Обработка завершена:`);
    console.log(`   Всего тикеров: ${totalTickers}`);
    console.log(`   Исключено: ${excludedCount}`);
    console.log(`   Осталось: ${totalTickers - excludedCount}`);

    // Возвращаем отфильтрованный CSV
    const fileName = `filtered_${exchange}_${Date.now()}.csv`;

    return new NextResponse(filteredCSV, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${fileName}"`
      }
    });

  } catch (error) {
    console.error('Ошибка фильтрации:', error);
    return NextResponse.json(
      { error: 'Ошибка при обработке: ' + error.message },
      { status: 500 }
    );
  }
}