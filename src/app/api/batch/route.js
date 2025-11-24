import yahooFinance from 'yahoo-finance2';
import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { calculateExponentialResistanceLine } from '../../lib/level2Analysis';
import { calculateExponentialSupportLine } from '../../lib/level1Analysis';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const startDate = formData.get('startDate');
    const endDate = formData.get('endDate');
    const analysisType = formData.get('analysisType'); // 'level1' или 'level2'
    
    // НОВЫЕ ПАРАМЕТРЫ
    const point1MaxDay = formData.get('point1MaxDay');
    const point2MinDay = formData.get('point2MinDay');
    const minTradesPercent = formData.get('minTradesPercent');

    if (!file || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Читаем Excel файл
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

    // Получаем список тикеров из первого столбца
    const tickers = data
      .map(row => row[0])
      .filter(ticker => ticker && typeof ticker === 'string')
      .map(ticker => ticker.toString().toUpperCase().trim());

    if (tickers.length === 0) {
      return NextResponse.json(
        { error: 'No tickers found in file' },
        { status: 400 }
      );
    }

    // Обрабатываем каждый тикер
    const results = [];
    
    for (const ticker of tickers) {
      try {
        // Получаем данные акций
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setDate(end.getDate() + 1);

        const result = await yahooFinance.chart(ticker, {
          period1: start,
          period2: end,
          interval: '1d'
        });

        const stockData = result.quotes.map(quote => ({
          date: quote.date,
          open: quote.open,
          high: quote.high,
          low: quote.low,
          close: quote.close,
          volume: quote.volume
        }));

        if (stockData.length === 0) {
          // НЕ добавляем строку если нет данных
          console.log(`${ticker}: Нет данных - пропускаем`);
          continue;
        }

        // Парсим параметры фильтров
        const p1MaxDay = point1MaxDay ? parseInt(point1MaxDay) : null;
        const p2MinDay = point2MinDay ? parseInt(point2MinDay) : null;
        const minTrades = minTradesPercent ? parseFloat(minTradesPercent) : 0;

        // Выбираем тип анализа
        let analysisResult;
        if (analysisType === 'level1') {
          analysisResult = calculateExponentialSupportLine(stockData, p1MaxDay, p2MinDay, minTrades);
        } else {
          analysisResult = calculateExponentialResistanceLine(stockData, p1MaxDay, p2MinDay, minTrades);
        }

        // ВАЖНО: Если analysisResult === null, это значит НЕ прошли фильтры
        // Возможные причины:
        // 1. Точка 1 не в нужном диапазоне
        // 2. Точка 2 не в последних N днях
        // 3. Не найдена стратегия с нужным % сделок
        if (!analysisResult) {
          console.log(`${ticker}: ❌ Не прошел фильтры - строка удалена`);
          continue;
        }

        const point1 = analysisResult.points[0];
        const point2 = analysisResult.points[1];
        const strategy = analysisResult.tradingStrategy;

        // КРИТИЧНО: Если стратегии нет - не добавляем строку
        if (!strategy) {
          console.log(`${ticker}: ❌ Стратегия не найдена - строка удалена`);
          continue;
        }

        // НОВАЯ СТРУКТУРА: раздельные колонки вместо дроби
        results.push([
          ticker,
          point1.price.toFixed(2),
          point2.price.toFixed(2),
          point1.index + 1,
          point2.index + 1,
          analysisResult.percentPerDayPercent + '%',
          strategy.avgPercentPerDay + '%',
          strategy.entryPercent + '%',
          strategy.exitPercent + '%',
          strategy.totalTrades, // Трейды (чистые)
          strategy.totalDays, // Всего дней
          strategy.hasFactClose, // Закрыто по факту (0 или 1)
          strategy.tradesPercent + '%' // Процент сделок
        ]);

        console.log(`${ticker}: ✅ Обработан успешно`);

      } catch (error) {
        console.error(`Error processing ${ticker}:`, error);
        // Ошибка при загрузке - тоже НЕ добавляем
        continue;
      }
    }

    // Если нет результатов
    if (results.length === 0) {
      return NextResponse.json(
        { error: 'Ни один тикер не прошел фильтры или не были найдены данные' },
        { status: 400 }
      );
    }

    // Создаем новый Excel файл с результатами
    const wb = XLSX.utils.book_new();
    const sheetName = analysisType === 'level1' ? 'Level1 Support' : 'Level2 Resistance';
    const ws = XLSX.utils.aoa_to_sheet([
      [
        'Тикер', 
        'Цена точки 1', 
        'Цена точки 2', 
        'День 1', 
        'День 2', 
        'Процент в день',
        'Средний % в день',
        '% для входа',
        '% для выхода',
        'Трейды', // НОВОЕ: отдельная колонка
        'Всего дней', // НОВОЕ: отдельная колонка
        'Закрыто по факту', // НОВОЕ: 0 или 1
        'Процент сделок' // НОВОЕ: отдельная колонка
      ],
      ...results
    ]);

    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // Конвертируем в buffer
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Возвращаем файл
    const fileName = analysisType === 'level1' 
      ? `level1_support_results_${Date.now()}.xlsx`
      : `level2_resistance_results_${Date.now()}.xlsx`;

    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`
      }
    });

  } catch (error) {
    console.error('Batch processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process batch request' },
      { status: 500 }
    );
  }
}