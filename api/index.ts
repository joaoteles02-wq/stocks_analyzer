export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const url = new URL(req.url, `https://${req.headers.host}`);
  const pathname = url.pathname;

  if (!pathname.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }

  if (pathname === '/api/brapi-price') {
    const ticker = url.searchParams.get('ticker');
    if (!ticker) {
      return res.status(400).json({ error: 'Missing ticker' });
    }

    const apiToken = process.env.BRAPI_API_KEY;
    if (!apiToken) {
      return res.status(500).json({ error: 'BRAPI_API_KEY not configured' });
    }

    try {
      const cleanTicker = ticker.trim().toUpperCase()
        .replace(/\.SA$/, '')
        .replace(/^BVMF:/, '')
        .trim();

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(
        `https://brapi.dev/api/quote/${encodeURIComponent(cleanTicker)}?token=${encodeURIComponent(apiToken)}`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);

      if (!response.ok) {
        return res.status(response.status).json({ error: `Brapi API error: ${response.statusText}` });
      }

      const data = await response.json();
      const price = data?.results?.[0]?.regularMarketPrice ?? null;

      if (price === null) {
        return res.status(404).json({ error: 'Price not available from Brapi' });
      }

      return res.json({ price, ticker: cleanTicker });
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return res.status(504).json({ error: 'Brapi API timeout' });
      }
      console.error('Brapi Price Error:', error);
      return res.status(500).json({ error: error.message || 'Failed to fetch current price from Brapi' });
    }
  }

  return res.status(404).json({ error: 'Endpoint not found' });
}
