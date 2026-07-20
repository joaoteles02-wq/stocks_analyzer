import YahooFinanceImport from 'yahoo-finance2';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

// Helper to call Gemini SDK directly
async function callGemini(prompt: string, systemInstruction?: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API Key is not configured.');
  
  const ai = new GoogleGenAI({ apiKey });
  let response;
  let attempts = 0;
  const maxAttempts = 4;
  let delay = 1000;

  while (attempts < maxAttempts) {
    try {
      attempts++;
      response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: systemInstruction ? `${systemInstruction}\n\n${prompt}` : prompt
      });
      break;
    } catch (genError: any) {
      console.warn(`Gemini API attempt ${attempts} failed:`, genError);
      const errMsg = (genError.message || "").toLowerCase();
      const isRateLimit = errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("resource_exhausted");
      const isHighDemand = errMsg.includes("503") || errMsg.includes("high demand") || errMsg.includes("temporary") || errMsg.includes("unavailable");
      
      if ((isRateLimit || isHighDemand) && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      } else {
        throw genError;
      }
    }
  }

  const text = response?.text;
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

    // ---------- /api/public-sheet ----------
    if (pathname === '/api/public-sheet') {
      const id = url.searchParams.get('id');
      const sheet = url.searchParams.get('sheet');
      if (!id || !sheet) {
        return res.status(400).json({ error: "Missing 'id' or 'sheet' parameters" });
      }

      const publicUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=tsv&sheet=${encodeURIComponent(sheet)}`;
      try {
        const gRes = await fetch(publicUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; StocksAnalyzer/1.0)" },
        });

        if (!gRes.ok) {
          const text = await gRes.text().catch(() => gRes.statusText);
          if (text.includes("accounts.google.com") || text.includes("Sign in")) {
            return res.status(403).json({
              error: "A planilha é privada. Torne-a pública (qualquer pessoa com o link) ou conecte sua conta Google.",
            });
          }
          return res.status(gRes.status).json({ error: `Google retornou ${gRes.status}` });
        }

        const tsv = await gRes.text();
        const rows = tsv.split("\n").map((row) =>
          row.split("\t").map((cell) => cell.replace(/\r$/, ""))
        );

        while (rows.length > 0 && rows[rows.length - 1].every((c) => c === "")) {
          rows.pop();
        }

        return res.json({ rows, sheet, count: rows.length });
      } catch (err: any) {
        console.error("[PublicSheet] Fetch error:", err.message);
        return res.status(500).json({ error: err.message || "Failed to fetch public sheet" });
      }
    }

    // ---------- /api/public-sheet-names ----------
    if (pathname === '/api/public-sheet-names') {
      const id = url.searchParams.get('id');
      if (!id) {
        return res.status(400).json({ error: "Missing 'id' parameter" });
      }

      const editUrl = `https://docs.google.com/spreadsheets/d/${id}/edit`;
      try {
        const gRes = await fetch(editUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; StocksAnalyzer/1.0)",
            "Accept": "text/html",
          },
        });
        const html = await gRes.text();

        const matches = [...html.matchAll(/"([^"]{1,60})",\s*(?:null|0|1),\s*0,\s*null,\s*0,\s*null,\s*null,\s*null,\s*null,\s*null,\s*1/g)];
        const sheets = matches.map((m) => m[1]).filter((s) => s.length > 0);

        if (sheets.length === 0) {
          return res.json({ sheets: ["AÇÕES", "FII", "S&P500"] });
        }

        return res.json({ sheets });
      } catch (err: any) {
        console.error("[PublicSheetNames] Error:", err.message);
        return res.json({ sheets: ["AÇÕES", "FII", "S&P500"] });
      }
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
      if (token && spreadsheetId && spreadsheetId !== 'local') {
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
      } else if (!finalSheetData && spreadsheetId && spreadsheetId !== 'local' && sheetName && sheetName !== 'local') {
        console.log('[process-data] No OAuth token — attempting public TSV fetch for sheet:', sheetName);
        const publicUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=tsv&sheet=${encodeURIComponent(sheetName)}`;
        const pubRes = await fetch(publicUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StocksAnalyzer/1.0)' }
        });

        if (pubRes.ok) {
          const tsv = await pubRes.text();
          if (tsv.includes('accounts.google.com') || tsv.includes('Sign in')) {
            return res.status(403).json({
              error: 'A planilha é privada. Torne-a pública ("qualquer pessoa com o link pode ver") ou faça login com o Google para continuar.'
            });
          }
          const rows = tsv.split('\n').map(row =>
            row.split('\t').map(cell => cell.replace(/\r$/, ''))
          );
          while (rows.length > 0 && rows[rows.length - 1].every(c => c === '')) rows.pop();
          finalSheetData = rows;
          console.log('[process-data] Public fetch successful —', finalSheetData.length, 'rows');
        } else {
          console.warn('[process-data] Public TSV fetch failed:', pubRes.status);
          return res.status(403).json({
            error: 'Não foi possível ler a planilha sem login. Verifique se ela está pública ou faça login com o Google.'
          });
        }
      }
      if (!finalSheetData) {
        return res.status(400).json({ error: 'No sheet data provided.' });
      }
      const maxRows = 200; // Limit to prevent hitting token quotas
      const limitedData = Array.isArray(finalSheetData) ? finalSheetData.slice(0, maxRows) : finalSheetData;

      const isFii = analysisType === 'fii';
      const isSp500 = analysisType === 'sp500';
      let prompt = "";

      if (isFii) {
        prompt = `Você é um analista financeiro experiente e gestor de carteiras especializado em Fundos de Investimentos Imobiliários (FIIs) no Brasil.
      O usuário forneceu os dados de uma planilha contendo índices e indicadores de Fundos Imobiliários (FIIs) e notas explicativas.
      Sua tarefa é analisar os dados globalmente de acordo com a planilha e criar um ranking completo com exatamente as 10 melhores opções (Top 10) focando em máxima geração de renda com segurança.
      
      **DIRETRIZ DE SELEÇÃO OTIMIZADA (REGRAS DE FILTRO)**:
      1. Identifique as colunas de Ticker/Ativo, Segmento/Setor, Dividend Yield (DY ou Div. Yield), e P/VP (Preço sobre Valor Patrimonial, normalmente representado em decimal como 0.90, 1.00 ou em percentual).
      2. Filtre os fundos priorizando aqueles com o maior Dividend Yield (DY) cuja relação P/VP esteja estritamente na faixa de 0.85 a 1.05. Isso garante um desconto patrimonial sem comprar fundos excessivamente arriscados ou supervalorizados.
      3. Selecione exatamente os 10 melhores FIIs de acordo com esse critério.
      
      **REGRA DE PORTUGUÊS/INÍCIO OBRIGATÓRIA**: O relatório gerado deve ser escrito inteiramente em português e **SEMPRE começar diretamente** com o título e em seguida um índice ou resumo numerado contendo estritamente e exclusivamente os 10 ativos selecionados para o ranking Top 10 (NÃO liste outros ativos para não poluir o relatório, liste APENAS as 10 melhores opções selecionadas, uma por linha), no seguinte formato exato (sem dilações antes, comece direto no número 1):
      1. TICKER - Segmento (especificação curtíssima de 5-8 palavras)
      2. TICKER - Segmento (especificação curtíssima de 5-8 palavras)
      ...
      
      Depois de listar a lista reduzida dos 10 ativos escolhidos no início, insira uma linha em branco e então prossiga obrigatoriamente com:
      
      ### 1. Ranking Detalhado dos Top 10 FIIs
      Apresente o ranking detalhado de 1 a 10 de forma visualmente agradável usando títulos em Markdown, listas e parágrafos. Para cada FII, informe:
      - **Posição e Ticker** (Exemplo: #### 1º Lugar - HGLG11)
      - **Segmento:** (Exemplo: Logística, Recebíveis, Lajes Corporativas, Shoppings, etc.)
      - **Métricas:** (Dividend Yield e P/VP identificados nos dados)
      - **Motivo da Escolha:** Um parágrafo fundamentado explicando por que este ativo foi selecionado com base nos múltiplos.
      
      ### 2. Análise Consolidada do Top 10 (Portfólio Recomendado)
      Faça uma análise de portfólio automatizada para o conjunto das 10 FIIs escolhidos contendo:
      - **Diversificação Setorial:** Apresente um resumo textual ou em formato de lista (representando um gráfico de barras/pizza conceitual) demonstrando a distribuição dos FIIs entre os segmentos (Tijolo, Papel, Híbrido, etc.) para alertar o investidor sobre riscos de concentração de risco em um único segmento.
      - **Múltiplo Médio de P/VP:** Calcule e exiba o P/VP médio das 10 selecionadas.
      - **Retorno Esperado Estimado (Yield Médio):** Calcule e exiba a projeção de Dividend Yield anualizado médio deste portfólio Top 10.
      - **Ressalva Defensiva:** Explique como a diversificação setorial protege o investidor contra vacância física e risco de crédito de recebíveis.
      
      DADOS DA PLANILHA (Limitado às primeiras ${maxRows} linhas para análise):
      ${JSON.stringify(limitedData, null, 2)}
      `;
      } else if (isSp500) {
        prompt = `Você é um analista financeiro de investimentos globais, especializado no mercado norte-americano e no índice S&P 500.
      O usuário forneceu os dados de uma planilha contendo índices, métricas financeiras e notas explicativas de empresas listadas no S&P 500.
      Sua tarefa é analisar os dados globalmente e identificar as 10 melhores ações do S&P 500 de acordo com as diretrizes de maximização de retorno e proteção de valor a médio/longo prazo.
      
      **DIRETRIZ DE SELEÇÃO OTIMIZADA (REGRAS DE FILTRO)**:
      1. Identifique as colunas de Ticker/Ativo, Setor, Preço, ROIC ou ROE (Rentabilidade), Dividend Yield, e se houver, colunas como EV/EBIT, EV/EBITDA ou LPA.
      2. Aplique a adaptação da Fórmula Mágica de Joel Greenblatt para o mercado americano (ordenando as empresas de forma combinada por maior eficiência de capital, como ROE/ROIC elevado, e múltiplos de valor saudáveis como menor EV/EBITDA ou PE) OU filtre pelas 10 melhores com base no maior LPA (Lucro por Ação) e margem de segurança.
      3. Selecione exatamente as 10 melhores ações.
      
      **REGRA DE PORTUGUÊS/INÍCIO OBRIGATÓRIA**: O relatório gerado deve ser escrito inteiramente em português e **SEMPRE começar diretamente** com o título e em seguida um índice ou resumo numerado contendo estritamente e exclusivamente as 10 ações selecionadas para o ranking Top 10, no seguinte formato exato (sem dilações antes, comece direto no número 1):
      1. TICKER - Setor (especificação curtíssima de 5-8 palavras)
      2. TICKER - Setor (especificação curtíssima de 5-8 palavras)
      ...
      
      Depois de listar a lista reduzida das 10 ações selecionadas no início, insira uma linha em branco e então prossiga obrigatoriamente com:
      
      ### 1. Ranking Detalhado das Top 10 Ações S&P 500
      Apresente o ranking detalhado de 1 a 10 de forma visualmente agradável usando títulos em Markdown, listas e parágrafos. Para cada empresa, informe:
      - **Posição, Empresa e Ticker** (Exemplo: #### 1º Lugar - Apple Inc. (AAPL))
      - **Setor / Indústria:** (Exemplo: Tecnologia da Informação, Saúde, Serviços de Comunicação, etc.)
      - **Fundamentos Identificados:** Indique as métricas de eficiência (ROE/ROIC) e de valor encontradas nos dados da planilha.
      - **Motivo da Escolha:** Explique qualitativamente e quantitativamente por que ela se destaca na estratégia de qualidade e múltiplos de valor atraentes.
      
      ### 2. Análise Consolidada do Top 10 (Portfólio Recomendado)
      Faça uma análise de portfólio automatizada para o conjunto das 10 ações americanas selecionadas contendo:
      - **Diversificação Setorial:** Faça um diagnóstico da concentração setorial (ex: peso em tecnologia vs consumo vs finanças) apontando se a carteira de ações globais está protegida ou concentrada.
      - **Saúde Financeira Média:** Se disponível na planilha (ex: coluna Divida liquida/Patrim. ou similar), estime a alavancagem média das empresas selecionadas.
      - **Retorno Esperado Estimado (Yield Médio):** Calcule o Dividend Yield médio ponderado deste grupo de 10 ações do S&P 500.
      
      DADOS DA PLANILHA (Limitado às primeiras ${maxRows} linhas para análise):
      ${JSON.stringify(limitedData, null, 2)}
      `;
      } else {
        prompt = `Você é um analista financeiro experiente de ações Brasileiras.
      O usuário forneceu os dados de uma planilha contendo índices de ações e notas explicativas. 
      Sua tarefa é analisar os dados globalmente e identificar quais as melhores ações brasileiras segundo os critérios da planilha e criar um ranking completo com exatamente as 10 melhores opções (Top 10).
      
      **DIRETRIZ DE SELEÇÃO OTIMIZADA (REGRAS DE FILTRO)**:
      1. Identifique as colunas correspondentes de Ticker/Ativo, Setor, Preço, ROIC (Retorno sobre Capital Investido), EV / EBIT (ou EV / EBITDA se EV/EBIT for omisso), Divida liquida/Patrim., Div. Yield e FORMULA GRAHAM.
      2. Aplique a Fórmula Mágica de Joel Greenblatt:
         - Classifique todas as empresas pelo menor múltiplo EV / EBIT (mais barato, valor ascendente).
         - Classifique todas as empresas pelo maior ROIC (mais eficiente, valor descendente).
         - Some as duas classificações (rankings) para obter a classificação final da Fórmula Mágica.
         - Ordene de forma crescente (menor soma de posições = melhor).
      3. Elimine ações com liquidez excessivamente baixa ou distorcidas por estarem em recuperação judicial (ex: RPMG3, OSXB3 se existirem na planilha).
      4. Selecione exatamente as 10 melhores ações do ranking final.
      
      **REGRA DE PORTUGUÊS/INÍCIO OBRIGATÓRIA**: O relatório gerado deve ser escrito inteiramente em português e **SEMPRE começar diretamente** com o título e em seguida um índice ou resumo numerado contendo estritamente e exclusivamente os 10 ativos selecionados para o ranking Top 10, no seguinte formato exato (sem dilações antes, comece direto no número 1):
      1. TICKER - Setor (especificação curtíssima de 5-8 palavras)
      2. TICKER - Setor (especificação curtíssima de 5-8 palavras)
      ...
      
      Depois de listar a lista reduzida de no máximo 10 ações escolhidas no início, insira uma linha em branco e então prossiga com:
      
      ### 1. Ranking Detalhado das Top 10 Ações Brasileiras
      Apresente o ranking detalhado de 1 a 10 de forma visualmente agradável usando títulos em Markdown, listas e parágrafos. Para cada ação, informe:
      - **Posição e Ticker** (Exemplo: #### 1º Lugar - VALE3)
      - **Setor / Área de Atuação:** (Exemplo: Mineração, Energia Elétrica, Petróleo, etc.)
      - **Fundamentos Identificados:** Mencione o EV / EBIT, o ROIC e o Dividend Yield reais lidos na planilha para esta ação.
      - **Motivo da Escolha:** Justifique a seleção com base nos fundamentos de valor de Joel Greenblatt.
      
      ### 2. Análise Consolidada do Top 10 (Portfólio Recomendado)
      Faça uma análise de portfólio automatizada para o conjunto das 10 ações brasileiras selecionadas contendo:
      - **Diversificação Setorial:** Analise a distribuição setorial das 10 ações (ex: Utilities vs Financeiro vs Commodities) indicando a correlação e segurança. Diga se a carteira está bem equilibrada contra riscos de ciclos econômicos.
      - **Saúde Financeira Média (Alavancagem):** Calcule a média simples da relação Dívida Líquida / Patrimônio Líquido (Divida liquida/Patrim.) das 10 empresas selecionadas.
      - **Retorno Esperado Estimado e Upside:**
        - Calcule o Dividend Yield médio das 10 ações.
        - Calcule a margem de segurança média comparando o Preço atual com a Fórmula Graham (distância média percentual para o Preço Justo de Graham).
      
      DADOS DA PLANILHA (Limitado às primeiras ${maxRows} linhas para análise):
      ${JSON.stringify(limitedData, null, 2)}
      `;
      }

      const systemInstruction = "Você é um analista financeiro sênior especializado em mercado de capitais e assessoria de investimentos. Sua diretriz mais sagrada e inviolável é gerar um ranking de exatamente 10 ativos (Top 10) baseados nos dados fornecidos na planilha do usuário. Você está terminantemente proibido de listar todos os ativos, todos os 187 ativos lidos ou qualquer ativo além dos 10 melhores selecionados. O sumário inicial e o ranking detalhado subsequente devem constar exatamente 10 ativos (nem mais, nem menos). Escreva integralmente em português.";

      const result = await callGemini(prompt, systemInstruction);
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
