import YahooFinanceImport from 'yahoo-finance2';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Helper to call Gemini REST API directly
async function callGemini(prompt: string, systemInstruction?: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API Key is not configured.');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const body: any = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
  };
  if (systemInstruction) {
    body.system_instruction = { parts: [{ text: systemInstruction }] };
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini API');
  return text;
}

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

    // ---------- /api/wallet-insight ----------
    if (pathname === '/api/wallet-insight') {
      let body = '';
      await new Promise<void>((resolve) => {
        req.on('data', (chunk: string) => body += chunk);
        req.on('end', () => resolve());
      });
      let parsed: any = {};
      try { parsed = JSON.parse(body); } catch (e) {}
      let wallet = parsed.wallet;
      if (!wallet) {
        const rawWallet = url.searchParams.get('wallet') || req.headers?.['x-wallet-data'];
        if (typeof rawWallet === 'string') {
          try { wallet = JSON.parse(decodeURIComponent(rawWallet)); } catch (e) { /* ignore */ }
        }
      }
      if (!wallet || !Array.isArray(wallet)) {
        return res.status(400).json({ error: 'Invalid or missing wallet data.' });
      }
      const prompt = `Você é um assessor de investimentos sênior e estrategista de alocação global de carteiras.
A carteira do investidor contém exatamente 10 ativos com os seguintes pesos de alocação:
${wallet.map((w: any) => `- **${w.ticker}** (${w.name}): peso de ${w.weight}% (Tipo: ${w.type === 'stocks' ? 'Ação Brasileira' : w.type === 'fii' ? 'FII Brasileiro' : 'S&P 500'}, Setor: ${w.sector})`).join('\n')}

Faça uma análise crítica da carteira em português incluindo:
1. **Avaliação da Diversificação** entre Ações BR, FIIs e S&P 500
2. **Exposição Setorial** e riscos de concentração
3. **Análise de Yield** vs potencial de valorização
4. **Veredito** com sugestões de ajustes
Use Markdown, sem tabelas.`;
      const result = await callGemini(prompt);
      return res.json({ result });
    }

    // ---------- /api/process-data ----------
    if (pathname === '/api/process-data') {
      let body = '';
      await new Promise<void>((resolve) => {
        req.on('data', (chunk: string) => body += chunk);
        req.on('end', () => resolve());
      });
      let parsed: any = {};
      try { parsed = JSON.parse(body); } catch (e) {}
      let { sheetData, token, spreadsheetId, sheetName, analysisType } = parsed;
      if (!token) token = req.headers?.['x-google-token'] || url.searchParams.get('token') as string;
      if (!spreadsheetId) spreadsheetId = req.headers?.['x-spreadsheet-id'] || url.searchParams.get('spreadsheetId') as string;
      if (!sheetName) sheetName = req.headers?.['x-sheet-name'] || url.searchParams.get('sheetName') as string;
      if (!analysisType) analysisType = req.headers?.['x-analysis-type'] || url.searchParams.get('analysisType') as string;

      let finalSheetData = sheetData;
      if (token && spreadsheetId) {
        let activeSheet = sheetName;
        if (!activeSheet) {
          const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`;
          const metaRes = await fetch(metaUrl, { headers: { Authorization: `Bearer ${token}` } });
          if (!metaRes.ok) throw new Error(`Google Sheets Meta Error (${metaRes.status}): ${await metaRes.text()}`);
          activeSheet = (await metaRes.json()).sheets?.[0]?.properties?.title || 'Sheet1';
        }
        const valuesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(activeSheet)}!A1:Z500`;
        const valuesRes = await fetch(valuesUrl, { headers: { Authorization: `Bearer ${token}` } });
        if (!valuesRes.ok) throw new Error(`Google Sheets Values Error (${valuesRes.status}): ${await valuesRes.text()}`);
        finalSheetData = (await valuesRes.json()).values || [];
      }
      if (!finalSheetData) {
        return res.status(400).json({ error: 'No sheet data provided.' });
      }
      const maxRows = 200;
      const limitedData = Array.isArray(finalSheetData) ? finalSheetData.slice(0, maxRows) : finalSheetData;
      const isFii = analysisType === 'fii';
      const isSp500 = analysisType === 'sp500';
      const categoryLabel = isFii ? 'FIIs' : isSp500 ? 'Ações S&P 500' : 'Ações Brasileiras';
      const prompt = `Você é um analista financeiro experiente especializado em ${categoryLabel}.
Analise os dados da planilha abaixo e crie um ranking das 10 melhores opções (Top 10).
Escreva em português, comece diretamente com o título e a lista numerada dos 10 ativos selecionados (um por linha: "1. TICKER - descrição").
Depois insira análise detalhada: avaliação geral do mercado, ranking detalhado com justificativas e considerações finais sobre diversificação.
NÃO use tabelas. Use Markdown com títulos e parágrafos.

DADOS DA PLANILHA (primeiras ${maxRows} linhas):
${JSON.stringify(limitedData, null, 2)}`;
      const result = await callGemini(prompt, `Você é um analista financeiro sênior. Gere UM ranking de EXATAMENTE 10 ativos (Top 10) baseado nos dados fornecidos.`);
      return res.json({ result });
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
