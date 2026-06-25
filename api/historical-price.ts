import YahooFinanceImport from 'yahoo-finance2';

const YahooFinance = (YahooFinanceImport as any).default ?? YahooFinanceImport;
const yahooFinance = new YahooFinance();

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const { ticker, date } = req.query;

  if (!ticker || !date) {
    return res.status(400).json({ error: 'Missing ticker or date' });
  }

  try {
    const startDate = new Date(date as string);
    const endDate = new Date(date as string);
    endDate.setDate(endDate.getDate() + 7);
    const period2Str = endDate.toISOString().split('T')[0];

    const result: any = await yahooFinance.historical(ticker as string, {
      period1: date as string,
      period2: period2Str,
    });

    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'Price not found' });
    }

    return res.json({ price: result[0].close });
  } catch (error: any) {
    console.error('Historical Price Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch price' });
  }
}
