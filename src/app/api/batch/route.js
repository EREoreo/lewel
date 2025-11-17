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
          results.push([ticker, 'Нет данных', '', '', '', '', '', '', '', '']);
          continue;
        }

        // Выбираем тип анализа
        let analysisResult;
        if (analysisType === 'level1') {
          analysisResult = calculateExponentialSupportLine(stockData);
        } else {
          analysisResult = calculateExponentialResistanceLine(stockData);
        }

        if (!analysisResult) {
          results.push([ticker, 'Не найдено', '', '', '', '', '', '', '', '']);
          continue;
        }

        const point1 = analysisResult.points[0];
        const point2 = analysisResult.points[1];
        const strategy = analysisResult.tradingStrategy;

        results.push([
          ticker,
          point1.price.toFixed(2),
          point2.price.toFixed(2),
          point1.index + 1,
          point2.index + 1,
          analysisResult.percentPerDayPercent + '%',
          strategy ? strategy.avgPercentPerDay + '%' : 'N/A',
          strategy ? strategy.entryPercent + '%' : 'N/A',
          strategy ? strategy.exitPercent + '%' : 'N/A',
          strategy ? `${strategy.totalTrades}/${stockData.length}` : 'N/A'
        ]);

      } catch (error) {
        console.error(`Error processing ${ticker}:`, error);
        results.push([ticker, 'Ошибка', '', '', '', '', '', '', '', '']);
      }
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
        'Трейды/Дни'
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