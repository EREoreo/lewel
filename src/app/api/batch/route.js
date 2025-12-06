import yahooFinance from 'yahoo-finance2';
import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { calculateExponentialResistanceLine, calculateExponentialResistanceLineWithTest } from '../../lib/level2Analysis';
import { calculateExponentialSupportLine, calculateExponentialSupportLineWithTest } from '../../lib/level1Analysis';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const startDate = formData.get('startDate');
    const endDate = formData.get('endDate');
    const analysisType = formData.get('analysisType'); // 'level1' или 'level2'
    
    // ПАРАМЕТРЫ ФИЛЬТРОВ
    const point1MaxDay = formData.get('point1MaxDay');
    const point2MinDay = formData.get('point2MinDay');
    const minTradesPercent = formData.get('minTradesPercent');
    
    // ТЕСТОВЫЙ ПЕРИОД
    const testPeriodDays = formData.get('testPeriodDays');
    
    // 🆕 МНОЖИТЕЛИ
    const entryMultiplier = formData.get('entryMultiplier');
    const exitMultiplier = formData.get('exitMultiplier');

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

    console.log(`\n🚀 НАЧАЛО МАССОВОЙ ОБРАБОТКИ`);
    console.log(`Тикеров: ${tickers.length}`);
    console.log(`Период: ${startDate} - ${endDate}`);
    console.log(`Тип: ${analysisType}`);
    console.log(`Тестовый период: ${testPeriodDays || 'НЕТ'} дней`);
    console.log(`Фильтры: точка1≤${point1MaxDay || 'любой'}, точка2≥${point2MinDay || 'любой'}, %сделок≥${minTradesPercent || 0}%`);
    if (testPeriodDays) {
      console.log(`Множители: вход × ${entryMultiplier || 1.0}, выход × ${exitMultiplier || 1.0}`);
    }
    console.log('');

    // Обрабатываем каждый тикер
    const results = [];
    let processedCount = 0;
    let skippedCount = 0;
    
    for (const ticker of tickers) {
      try {
        console.log(`\n📊 Обработка ${ticker} (${processedCount + skippedCount + 1}/${tickers.length})`);
        
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
          console.log(`  ⚠️ Нет данных - пропускаем`);
          skippedCount++;
          continue;
        }

        console.log(`  📈 Загружено ${stockData.length} дней данных`);

        // Парсим параметры фильтров
        const p1MaxDay = point1MaxDay ? parseInt(point1MaxDay) : null;
        const p2MinDay = point2MinDay ? parseInt(point2MinDay) : null;
        const minTrades = minTradesPercent ? parseFloat(minTradesPercent) : 0;
        const testPeriod = testPeriodDays ? parseInt(testPeriodDays) : null;
        
        // 🆕 Парсим множители
        const entryMult = entryMultiplier ? parseFloat(entryMultiplier) : 1.0;
        const exitMult = exitMultiplier ? parseFloat(exitMultiplier) : 1.0;

        // Проверка тестового периода
        if (testPeriod && testPeriod >= stockData.length) {
          console.log(`  ⚠️ Тестовый период (${testPeriod}) >= всех дней (${stockData.length}) - пропускаем`);
          skippedCount++;
          continue;
        }

        // Выбираем тип анализа и функцию
        let analysisResult;
        
        if (analysisType === 'level1') {
          // LEVEL 1 - SUPPORT
          if (testPeriod && testPeriod < stockData.length) {
            console.log(`  🔬 Используем LEVEL 1 с тестовым периодом`);
            analysisResult = calculateExponentialSupportLineWithTest(
              stockData, 
              testPeriod, 
              p1MaxDay, 
              p2MinDay, 
              minTrades,
              entryMult,  // 🆕
              exitMult    // 🆕
            );
          } else {
            console.log(`  📊 Используем обычный LEVEL 1`);
            analysisResult = calculateExponentialSupportLine(
              stockData, 
              p1MaxDay, 
              p2MinDay, 
              minTrades
            );
          }
        } else {
          // LEVEL 2 - RESISTANCE
          if (testPeriod && testPeriod < stockData.length) {
            console.log(`  🔬 Используем LEVEL 2 с тестовым периодом`);
            analysisResult = calculateExponentialResistanceLineWithTest(
              stockData, 
              testPeriod, 
              p1MaxDay, 
              p2MinDay, 
              minTrades,
              entryMult,  // 🆕
              exitMult    // 🆕
            );
          } else {
            console.log(`  📊 Используем обычный LEVEL 2`);
            analysisResult = calculateExponentialResistanceLine(
              stockData, 
              p1MaxDay, 
              p2MinDay, 
              minTrades
            );
          }
        }

        // Если analysisResult === null, не прошли фильтры
        if (!analysisResult) {
          console.log(`  ❌ Не прошел фильтры - пропускаем`);
          skippedCount++;
          continue;
        }

        const point1 = analysisResult.points[0];
        const point2 = analysisResult.points[1];

        // Определяем какую стратегию использовать
        const strategy = analysisResult.testPeriodDays 
          ? analysisResult.testStrategy 
          : analysisResult.tradingStrategy;

        if (!strategy) {
          console.log(`  ❌ Стратегия не найдена - пропускаем`);
          skippedCount++;
          continue;
        }

        // 💡 ФОРМИРУЕМ СТРОКУ РЕЗУЛЬТАТА
        if (analysisResult.testPeriodDays) {
          // Режим с тестовым периодом - ОДНА СТРОКА
          
          // Проверяем есть ли результаты исследования
          if (!analysisResult.researchStrategy) {
            console.log(`  ⚠️ Нет исследуемого периода (пересечение) - пропускаем`);
            skippedCount++;
            continue;
          }
          
          results.push([
            ticker,
            parseFloat(point1.price.toFixed(2)),
            parseFloat(point2.price.toFixed(2)),
            point1.index + 1,
            point2.index + 1,
            parseFloat(analysisResult.percentPerDayPercent),
            // ТЕСТ
            parseFloat(strategy.avgPercentPerDay),
            parseFloat(strategy.entryPercent),
            parseFloat(strategy.exitPercent),
            strategy.totalTrades,
            strategy.totalDays,
            strategy.hasFactClose,
            parseFloat(strategy.tradesPercent),
            parseFloat(strategy.totalProfit),
            // ИССЛЕДОВАНИЕ
            parseFloat(analysisResult.researchStrategy.avgPercentPerDay),
            parseFloat(analysisResult.researchStrategy.entryPercent),
            parseFloat(analysisResult.researchStrategy.exitPercent),
            analysisResult.researchStrategy.totalTrades,
            analysisResult.researchStrategy.totalDays,
            analysisResult.researchStrategy.hasFactClose,
            parseFloat(analysisResult.researchStrategy.tradesPercent),
            parseFloat(analysisResult.researchStrategy.totalProfit),
            // МЕТРИКИ
            analysisResult.hasCrossing ? 'Да' : 'Нет',
            entryMult,
            exitMult
          ]);
          
          console.log(`  ✅ Обработан | Тест: ${strategy.avgPercentPerDay}% | Иссл: ${analysisResult.researchStrategy.avgPercentPerDay}%`);
        } else {
          // Обычный режим - стандартный формат (БЕЗ ЗНАКОВ %)
          results.push([
            ticker,
            parseFloat(point1.price.toFixed(2)),
            parseFloat(point2.price.toFixed(2)),
            point1.index + 1,
            point2.index + 1,
            parseFloat(analysisResult.percentPerDayPercent),
            parseFloat(strategy.avgPercentPerDay),
            parseFloat(strategy.entryPercent),
            parseFloat(strategy.exitPercent),
            strategy.totalTrades,
            strategy.totalDays,
            strategy.hasFactClose,
            parseFloat(strategy.tradesPercent)
          ]);
          
          console.log(`  ✅ Обработан успешно | Средний %: ${strategy.avgPercentPerDay}%`);
        }

        processedCount++;

      } catch (error) {
        console.error(`  ❌ Ошибка обработки ${ticker}:`, error.message);
        skippedCount++;
        continue;
      }
    }

    console.log(`\n📊 ИТОГИ:`);
    console.log(`Обработано успешно: ${processedCount}`);
    console.log(`Пропущено: ${skippedCount}`);
    console.log(`Всего тикеров: ${tickers.length}\n`);

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
    
    // 💡 ЗАГОЛОВКИ
    let headers;
    if (testPeriodDays) {
      // Расширенные заголовки для режима с тестом
      headers = [
        'Тикер', 
        'Цена точки 1', 
        'Цена точки 2', 
        'День 1', 
        'День 2', 
        'Процент в день',
        // ТЕСТ
        'ТЕСТ: Средний % в день',
        'ТЕСТ: % для входа',
        'ТЕСТ: % для выхода',
        'ТЕСТ: Трейды',
        'ТЕСТ: Всего дней',
        'ТЕСТ: Закрыто по факту',
        'ТЕСТ: Процент сделок',
        'ТЕСТ: Общая прибыль',
        // ИССЛЕДОВАНИЕ
        'ИССЛ: Средний % в день',
        'ИССЛ: % для входа (×МН)',
        'ИССЛ: % для выхода (×МН)',
        'ИССЛ: Трейды',
        'ИССЛ: Всего дней',
        'ИССЛ: Закрыто по факту',
        'ИССЛ: Процент сделок',
        'ИССЛ: Общая прибыль',
        // МЕТРИКИ
        'Пересечение?',
        'Множитель входа',
        'Множитель выхода'
      ];
    } else {
      // Стандартные заголовки
      headers = [
        'Тикер', 
        'Цена точки 1', 
        'Цена точки 2', 
        'День 1', 
        'День 2', 
        'Процент в день',
        'Средний % в день',
        '% для входа',
        '% для выхода',
        'Трейды',
        'Всего дней',
        'Закрыто по факту',
        'Процент сделок'
      ];
    }

    const ws = XLSX.utils.aoa_to_sheet([headers, ...results]);

    // Устанавливаем ширину колонок
    const colWidths = headers.map(() => ({ wch: 15 }));
    ws['!cols'] = colWidths;

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