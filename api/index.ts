import YahooFinanceImport from 'yahoo-finance2';
import fs from 'fs';
import os from 'os';
import path from 'path';

const YahooFinance = (YahooFinanceImport as any).default ?? YahooFinanceImport;
const yahooFinance = new YahooFinance();

// In-memory token/wallet stores (Vercel serverless: persisted per-instance only)
let inMemoryTokens: Record<string, string> = {};
let inMemoryWalletConfig: Record<string, any> = {};

const tokenFilePath = path.join(os.tmpdir(), "user_tokens.json");
const walletConfigPath = path.join(os.tmpdir(), "wallet_config.json");

function getStoredTokens(): Record<string, string> {
  try {
    if (fs.existsSync(tokenFilePath)) {
      return JSON.parse(fs.readFileSync(tokenFilePath, "utf8"));
    }
  } catch (e) { /* ignore */ }
  return inMemoryTokens;
}

function saveStoredTokens(tokens: Record<string, string>) {
  try {
    fs.writeFileSync(tokenFilePath, JSON.stringify(tokens, null, 2), "utf8");
  } catch (e) { /* ignore */ }
  inMemoryTokens = tokens;
}

function getWalletConfig(): Record<string, any> {
  try {
    if (fs.existsSync(walletConfigPath)) {
      return JSON.parse(fs.readFileSync(walletConfigPath, "utf8"));
    }
  } catch (e) { /* ignore */ }
  return inMemoryWalletConfig;
}

function saveWalletConfig(data: Record<string, any>) {
  try {
    fs.writeFileSync(walletConfigPath, JSON.stringify(data, null, 2), "utf8");
  } catch (e) { /* ignore */ }
  inMemoryWalletConfig = data;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-google-token, x-spreadsheet-id, x-sheet-name, x-analysis-type, x-wallet-data');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const url = new URL(req.url, `https://${req.headers.host}`);
  const pathname = url.pathname;

  if (!pathname.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    // ---------- /api/brapi-price ----------
    if (pathname === '/api/brapi-price') {
      const ticker = url.searchParams.get('ticker');
      if (!ticker) {
        return res.status(400).json({ error: 'Missing ticker' });
      }

      const apiToken = process.env.BRAPI_API_KEY;
      if (!apiToken) {
        return res.status(500).json({ error: 'BRAPI_API_KEY not configured' });
      }

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
    }

    // ---------- /api/current-price (Yahoo fallback) ----------
    if (pathname === '/api/current-price') {
      const ticker = url.searchParams.get('ticker');
      if (!ticker) {
        return res.status(400).json({ error: 'Missing ticker' });
      }

      const quote = await yahooFinance.quote(ticker as string);
      const price = quote.regularMarketPrice ?? quote.previousClose ?? null;
      if (price === null) {
        return res.status(404).json({ error: 'Price not available' });
      }
      return res.json({ price });
    }

    // ---------- /api/historical-price ----------
    if (pathname === '/api/historical-price') {
      const ticker = url.searchParams.get('ticker');
      const date = url.searchParams.get('date');
      if (!ticker || !date) {
        return res.status(400).json({ error: 'Missing ticker or date' });
      }

      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 7);
      const period2Str = endDate.toISOString().split('T')[0];

      const result: any = await yahooFinance.historical(ticker, {
        period1: date,
        period2: period2Str,
      });

      if (!result || result.length === 0) {
        return res.status(404).json({ error: 'Price not found' });
      }

      return res.json({ price: result[0].close });
    }

    // ---------- /api/save-token ----------
    if (pathname === '/api/save-token' && req.method === 'POST') {
      let body = '';
      await new Promise<void>((resolve) => {
        req.on('data', (chunk: string) => body += chunk);
        req.on('end', () => resolve());
      });
      const parsed = JSON.parse(body);
      const { uid, token } = parsed;
      if (!uid || !token) {
        return res.status(400).json({ error: 'Missing uid or token' });
      }
      const tokens = getStoredTokens();
      tokens[uid] = token;
      saveStoredTokens(tokens);
      return res.json({ success: true });
    }

    // ---------- /api/get-token ----------
    if (pathname === '/api/get-token') {
      const uid = url.searchParams.get('uid');
      if (!uid) {
        return res.status(400).json({ error: 'Missing uid parameter' });
      }
      const tokens = getStoredTokens();
      const token = tokens[uid] || null;
      return res.json({ token });
    }

    // ---------- /api/wallet-config (GET) ----------
    if (pathname === '/api/wallet-config' && req.method === 'GET') {
      const config = getWalletConfig();
      return res.json(config);
    }

    // ---------- /api/wallet-config (POST) ----------
    if (pathname === '/api/wallet-config' && req.method === 'POST') {
      let body = '';
      await new Promise<void>((resolve) => {
        req.on('data', (chunk: string) => body += chunk);
        req.on('end', () => resolve());
      });
      const data = JSON.parse(body);
      saveWalletConfig(data);
      return res.json({ success: true });
    }

    // ---------- /api/test_env ----------
    if (pathname === '/api/test_env') {
      return res.json({ env: process.env.NODE_ENV, test: 'ok' });
    }

    // ---------- Fallback ----------
    return res.status(404).json({ error: 'Endpoint not found' });
  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
