const yahooFinance = require('yahoo-finance2').default;

async function getData() {
    try {
        const result = await yahooFinance.historical('MSFT', {
            period1: '2025-08-30',
            period2: '2025-09-20',
        });
        
        result.forEach(day => {
            console.log(`📅 ${day.date.toLocaleDateString()}`);
            console.log(`  Min: $${day.low.toFixed(2)}`);
            console.log(`  Max: $${day.high.toFixed(2)}`);
            console.log(`  Open: $${day.open.toFixed(2)}`);
            console.log(`  Close: $${day.close.toFixed(2)}`);
            console.log('─'.repeat(40));
        });
    } catch (error) {
        console.error('Error:', error);
    }
}

getData();