import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import cors from "cors";
import fs from "fs";
import os from "os";
import YahooFinanceImport from 'yahoo-finance2';

import('dotenv/config').catch(() => {});

// Workaround: esbuild CJS output wrappa o módulo ESM com __toESM,
// colocando o module.exports inteiro em .default. Esta verificação
// garante o construtor correto tanto em dev (tsx) quanto em produção (esbuild).
const YahooFinance = (YahooFinanceImport as any).default ?? YahooFinanceImport;
const yahooFinance = new YahooFinance();

// Prevent server from crashing on unhandled Yahoo Finance / network errors
process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught Exception (server kept alive):', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled Rejection (server kept alive):', reason);
});

const app = express();

async function startServer() {
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Add CORS to allow external frontends (e.g. GitHub Pages) to hit this API
  app.use(cors({ origin: "*" }));
  app.options("*", cors());

  // Middleware to parse large JSON bodies (spreadsheet data can be big)
  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get("/api/test_env", (req, res) => {
    res.json({ env: process.env.NODE_ENV, test: "ok" });
  });

  app.all("/api/wallet-insight", async (req, res) => {
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    try {
      let wallet = req.body?.wallet;

      // If POST body was dropped/redirected, parse from query param or custom header for mobile compatibility
      if (!wallet) {
        const rawWallet = req.query?.wallet || req.headers?.["x-wallet-data"];
        if (typeof rawWallet === "string") {
          try {
            wallet = JSON.parse(decodeURIComponent(rawWallet));
          } catch (e) {
            console.error("Failed to parse fallback wallet string:", e);
          }
        }
      }

      if (!wallet || !Array.isArray(wallet)) {
        return res.status(400).json({ error: "Dados da carteira inválidos ou não fornecidos." });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Chave do Gemini não configurada." });
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const prompt = `Você é um assessor de investimentos sênior e estrategista de alocação global de carteiras.
Os dados a seguir representam uma carteira mista diversificada contendo ativos selecionados a partir de uma biblioteca das 30 melhores recomendações do investidor (unindo as melhores Ações brasileiras, FIIs brasileiros e ativos do S&P 500 dos EUA).

A carteira do investidor contém exatamente 10 ativos com os seguintes pesos de alocação:
${wallet.map((w: any) => `- **${w.ticker}** (${w.name}): peso de ${w.weight}% (Tipo de ativo: ${w.type === 'stocks' ? 'Ação Brasileira' : w.type === 'fii' ? 'FII Brasileiro' : 'S&P 500 / Internacional'}, Setor: ${w.sector})`).join('\n')}

Por favor, faça uma análise crítica e construtiva da carteira montada sob o título "### Análise Detalhada da Carteira por IA".

Por favor, inclua os seguintes pontos na sua resposta formatada em Markdown em PORTUGUÊS:
1. **Avaliação da Diversificação:** Analise a distribuição entre Ações Brasileiras, FIIs Brasileiros e Ativos do S&P 500. Destaque se a carteira está bem equilibrada geograficamente e conceitualmente (atrelar crescimento de empresas gringas com dividendos robustos de fundos brasileiros).
2. **Exposição Setorial:** Comente sobre os setores predominantes na carteira e se a dispersão é elogiável ou se há riscos de concentração.
3. **Análise de Yield Simulado:** Estime em termos qualitativos/comparativos o potencial de geração de renda passiva (dividendos) de curto prazo vs. potencial de valorização de longo prazo com base nas características gerais desses ativos.
4. **Resumo / Veredito:** Forneça um veredito direto de 1 parágrafo validando a carteira do usuário ou sugerindo pequenos ajustes finais.

Mantenha uma linguagem muito profissional, direta e sofisticada. Não use tabelas comuns para rankings. Comece sua resposta diretamente com os tópicos/títulos em Markdown.`;

      let response;
      let attempts = 0;
      const maxAttempts = 3;
      let delay = 1000;

      while (attempts < maxAttempts) {
        try {
          attempts++;
          response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
          });
          break;
        } catch (genError: any) {
          console.warn(`Gemini API wallet attempt ${attempts} failed:`, genError);
          const errMsg = (genError.message || "").toLowerCase();
          const isRateLimit = errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("resource_exhausted");
          
          if (isRateLimit && attempts < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay *= 2;
          } else {
            throw genError;
          }
        }
      }

      if (!response || !response.text) {
        throw new Error("Não foi possível obter a análise da carteira pelo Gemini.");
      }

      res.json({ result: response.text });
    } catch (error: any) {
      console.error("Wallet Insight Error:", error);
      res.status(500).json({ error: error.message || "Ocorreu um erro ao obter análise da carteira" });
    }
  });

  // Proxy for Brapi API real-time quote — obtém o preço unitário do ativo
  // Replica: =GOOGLEFINANCE(Ticker) usando dados de mercado Brapi
  app.get("/api/brapi-price", async (req, res) => {
    const { ticker } = req.query;
    if (!ticker) {
      return res.status(400).json({ error: "Missing ticker" });
    }

    try {
      // Normaliza o ticker: remove .SA, BVMF: e espaços, converte para maiúsculas
      const rawTicker = (ticker as string).trim().toUpperCase();
      const cleanTicker = rawTicker
        .replace(/\.SA$/, '')
        .replace(/^BVMF:/, '')
        .trim();

      const apiToken = process.env.BRAPI_API_KEY;
      if (!apiToken) {
        return res.status(500).json({ error: "BRAPI_API_KEY not configured" });
      }

      const url = `https://brapi.dev/api/quote/${encodeURIComponent(cleanTicker)}?token=${encodeURIComponent(apiToken)}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        return res.status(response.status).json({ error: `Brapi API error: ${response.statusText}` });
      }

      const data = await response.json();
      const quote = data?.results?.[0] ?? null;
      const price = quote?.regularMarketPrice ?? null;
      const dividendYield = quote?.dividendYield ?? null;

      if (price === null) {
        return res.status(404).json({ error: "Price not available from Brapi" });
      }

      res.json({ price, dividendYield, ticker: cleanTicker });
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return res.status(504).json({ error: "Brapi API timeout" });
      }
      console.error("Brapi Price Error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch current price from Brapi" });
    }
  });

  // Proxy for Yahoo Finance real-time quote — replicates =GOOGLEFINANCE(Ticker)
  // Mantido como fallback para compatibilidade
  app.get("/api/current-price", async (req, res) => {
    const { ticker } = req.query;
    if (!ticker) {
      return res.status(400).json({ error: "Missing ticker" });
    }

    try {
      const quote = await yahooFinance.quote(ticker as string);
      const price = quote?.regularMarketPrice ?? quote?.previousClose ?? null;
      if (price === null) {
        return res.status(404).json({ error: "Price not available" });
      }
      res.json({ price });
    } catch (error: any) {
      if (error?.result?.[0]) {
        const price = error.result[0].regularMarketPrice ?? error.result[0].previousClose ?? null;
        if (price !== null) {
          return res.json({ price });
        }
      }
      console.error("Current Price Error:", error.message);
      res.status(404).json({ error: "Price not available" });
    }
  });

  // Retorna o Dividend Yield via Yahoo Finance (campo dividendYield da quote)
  app.get("/api/dividend-yield", async (req, res) => {
    const { ticker } = req.query;
    if (!ticker) {
      return res.status(400).json({ error: "Missing ticker" });
    }

    try {
      const quote = await yahooFinance.quote(ticker as string);
      const dividendYield = quote?.dividendYield ?? null;
      res.json({ dividendYield, ticker });
    } catch (error: any) {
      if (error?.result?.[0]) {
        const dy = error.result[0].dividendYield ?? null;
        return res.json({ dividendYield: dy, ticker });
      }
      console.error("Dividend Yield Error:", error.message);
      res.json({ dividendYield: null, ticker });
    }
  });

  // Proxy for Yahoo Finance API to avoid CORS issues
  // Replicates: =INDEX(GOOGLEFINANCE(Ticker; "close"; Data); 2; 2)
  app.get("/api/historical-price", async (req, res) => {
    const { ticker, date } = req.query;
    if (!ticker || !date) {
      return res.status(400).json({ error: "Missing ticker or date" });
    }

    try {
      const endDate = new Date(date as string);
      endDate.setDate(endDate.getDate() + 7);

      const period2Str = endDate.toISOString().split('T')[0];

      const result: any = await yahooFinance.historical(ticker as string, {
        period1: date as string,
        period2: period2Str,
      });

      if (!result || result.length === 0) {
        return res.status(404).json({ error: "Price not found" });
      }

      res.json({ price: result[0].close });
    } catch (error: any) {
      console.error("Historical Price Error:", error.message);
      res.status(404).json({ error: "Price not available" });
    }
  });

  // Persistent server side session store for Google Access Tokens
  const tokenFilePath = path.join(os.tmpdir(), "user_tokens.json");
  let inMemoryTokens: Record<string, string> = {};

  const getStoredTokens = (): Record<string, string> => {
    try {
      if (fs.existsSync(tokenFilePath)) {
        return JSON.parse(fs.readFileSync(tokenFilePath, "utf8"));
      }
    } catch (e) {
      console.error("Error reading token file:", e);
    }
    return inMemoryTokens;
  };

  const saveStoredTokens = (tokens: Record<string, string>) => {
    try {
      fs.writeFileSync(tokenFilePath, JSON.stringify(tokens, null, 2), "utf8");
    } catch (e) {
      console.error("Error writing token file:", e);
    }
    inMemoryTokens = tokens;
  };

  app.post("/api/save-token", (req, res) => {
    const { uid, token } = req.body || {};
    if (!uid || !token) {
      return res.status(400).json({ error: "Missing uid or token" });
    }
    const tokens = getStoredTokens();
    tokens[uid] = token;
    saveStoredTokens(tokens);
    console.log(`=> Saved Google OAuth token for user ${uid}`);
    res.json({ success: true });
  });

  app.get("/api/get-token", (req, res) => {
    const uid = req.query.uid as string;
    if (!uid) {
      return res.status(400).json({ error: "Missing uid parameter" });
    }
    const tokens = getStoredTokens();
    const token = tokens[uid] || null;
    res.json({ token });
  });

  // Persistent wallet config sync across devices
  const walletConfigPath = path.join(os.tmpdir(), "wallet_config.json");
  let inMemoryWalletConfig: Record<string, any> = {};

  const getWalletConfig = (): Record<string, any> => {
    try {
      if (fs.existsSync(walletConfigPath)) {
        return JSON.parse(fs.readFileSync(walletConfigPath, "utf8"));
      }
    } catch (e) {
      console.error("Error reading wallet config:", e);
    }
    return inMemoryWalletConfig;
  };

  const saveWalletConfig = (data: Record<string, any>) => {
    try {
      fs.writeFileSync(walletConfigPath, JSON.stringify(data, null, 2), "utf8");
    } catch (e) {
      console.error("Error writing wallet config:", e);
    }
    inMemoryWalletConfig = data;
  };

  app.get("/api/wallet-config", (_req, res) => {
    const config = getWalletConfig();
    res.json(config);
  });

  app.post("/api/wallet-config", (req, res) => {
    const data = req.body || {};
    saveWalletConfig(data);
    console.log("=> Wallet config saved");
    res.json({ success: true });
  });

  app.all("/api/process-data", async (req, res) => {
    console.log("=> HIT /api/process-data", req.method, req.url);
    
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }

    try {
      let { sheetData, token, spreadsheetId, sheetName, analysisType } = req.body || {};

      // Unified extraction to support GET or downgraded requests
      if (!token) {
        token = req.headers?.["x-google-token"] || req.query?.token;
      }
      if (!spreadsheetId) {
        spreadsheetId = req.headers?.["x-spreadsheet-id"] || req.query?.spreadsheetId;
      }
      if (!sheetName) {
        sheetName = req.headers?.["x-sheet-name"] || req.query?.sheetName;
      }
      if (!analysisType) {
        analysisType = req.headers?.["x-analysis-type"] || req.query?.analysisType;
      }
      if (!sheetData && req.query?.sheetData) {
        try {
          sheetData = JSON.parse(decodeURIComponent(req.query.sheetData as string));
        } catch (e) {}
      }

      let finalSheetData = sheetData;

      // If token and spreadsheetId are provided, fetch the data on the server
      if (token && spreadsheetId) {
        let activeSheet = sheetName;

        if (!activeSheet) {
          // Fetch metadata to find the first sheet name if not specified
          const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`;
          const metaRes = await fetch(metaUrl, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!metaRes.ok) {
            const errText = await metaRes.text();
            throw new Error(`Google Sheets Auth/Meta Error (${metaRes.status}): ${errText}`);
          }
          const metaData = await metaRes.json();
          activeSheet = metaData.sheets?.[0]?.properties?.title || "Sheet1";
        }

        // Fetch values
        const valuesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(activeSheet)}!A1:Z500`;
        const valuesRes = await fetch(valuesUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!valuesRes.ok) {
          const errText = await valuesRes.text();
          throw new Error(`Google Sheets Values Error (${valuesRes.status}): ${errText}`);
        }
        const valuesData = await valuesRes.json();
        finalSheetData = valuesData.values || [];
      }
      
      if (!finalSheetData) {
        return res.status(400).json({ error: "No sheet data provided." });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API Key is not configured." });
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
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
      Faça uma análise de portfólio automatizada para o conjunto dos 10 FIIs escolhidos contendo:
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

      let response;
      let attempts = 0;
      const maxAttempts = 4;
      let delay = 1000; // start with 1 second delay

      while (attempts < maxAttempts) {
        try {
          attempts++;
          response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `${systemInstruction}\n\n${prompt}`
          });
          break; // successfully generated, break out of loop
        } catch (genError: any) {
          console.warn(`Gemini API attempt ${attempts} failed:`, genError);
          const errMsg = (genError.message || "").toLowerCase();
          const isRateLimit = errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("resource_exhausted");
          const isHighDemand = errMsg.includes("503") || errMsg.includes("high demand") || errMsg.includes("temporary") || errMsg.includes("unavailable");
          
          if ((isRateLimit || isHighDemand) && attempts < maxAttempts) {
            console.log(`Waiting ${delay}ms before retry due to model demand/rate limit...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay *= 2; // exponential backoff
          } else {
            throw genError; // rethrow if it's not retryable or we've run out of attempts
          }
        }
      }

      if (!response || !response.text) {
        throw new Error("Could not retrieve a valid analysis from Gemini application.");
      }

      res.json({ result: response.text });
    } catch (error: any) {
      console.error("Analysis Error:", error);
      res.status(500).json({ error: error.message || "An error occurred during analysis" });
    }
  });

  // Log if anything falls through past API routes
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      console.log('API Request bypassed custom express routes!', req.method, req.path);
    }
    next();
  });

  // Vite middleware for development (only run when NOT on Vercel)
  if (!process.env.VERCEL) {
    if (process.env.NODE_ENV !== "production") {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  // Global Error Handler for API routes to prevent HTML responses
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.startsWith('/api/')) {
      console.error('Global API Error:', err);
      res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
    } else {
      next(err);
    }
  });

  // Only listen to port if NOT running on Vercel environment
  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

// Start the server setup (Vite integration / listener)
startServer();

// Export app for serverless function use (Vercel)
export { app };
