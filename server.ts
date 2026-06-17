import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import cors from "cors";
import fs from "fs";
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

// Prevent server from crashing on unhandled Yahoo Finance / network errors
process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught Exception (server kept alive):', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled Rejection (server kept alive):', reason);
});

async function startServer() {
  const app = express();
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
            model: 'gemini-3.5-flash',
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

  // Proxy for Yahoo Finance real-time quote — replicates =GOOGLEFINANCE(Ticker)
  app.get("/api/current-price", async (req, res) => {
    const { ticker } = req.query;
    if (!ticker) {
      return res.status(400).json({ error: "Missing ticker" });
    }

    try {
      const quote = await yahooFinance.quote(ticker as string);
      const price = quote.regularMarketPrice ?? quote.previousClose ?? null;
      if (price === null) {
        return res.status(404).json({ error: "Price not available" });
      }
      res.json({ price });
    } catch (error: any) {
      console.error("Current Price Error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch current price" });
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
      // Yahoo Finance requires a date range (period1 < period2).
      // We search from the target date up to 7 days later to capture
      // the closing price of the target day or the next available trading day.
      const startDate = new Date(date as string);
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

      // Return the first available closing price (closest to the requested date)
      res.json({ price: result[0].close });
    } catch (error: any) {
      console.error("Historical Price Error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch price" });
    }
  });

  // Persistent server side session store for Google Access Tokens
  const tokenFilePath = path.join(process.cwd(), "user_tokens.json");

  const getStoredTokens = (): Record<string, string> => {
    try {
      if (fs.existsSync(tokenFilePath)) {
        return JSON.parse(fs.readFileSync(tokenFilePath, "utf8"));
      }
    } catch (e) {
      console.error("Error reading token file:", e);
    }
    return {};
  };

  const saveStoredTokens = (tokens: Record<string, string>) => {
    try {
      fs.writeFileSync(tokenFilePath, JSON.stringify(tokens, null, 2), "utf8");
    } catch (e) {
      console.error("Error writing token file:", e);
    }
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
        prompt = `Você é um analista financeiro experiente especializado em Fundos de Investimentos Imobiliários (FIIs).
      O usuário forneceu os dados de uma planilha contendo índices e indicadores de Fundos Imobiliários (FIIs) e notas explicativas.
      Sua tarefa é analisar os dados globalmente de acordo com a planilha e criar um ranking completo com exatamente as 10 melhores opções (Top 10).
      
      **REGRA DE PORTUGUÊS/INÍCIO OBRIGATÓRIA**: O relatório gerado deve ser escrito inteiramente em português e **SEMPRE começar diretamente** com o título e em seguida um índice ou resumo numerado contendo estritamente e exclusivamente os 10 ativos selecionados para o ranking Top 10 (NÃO liste todos os 187 ativos ou todas as linhas lidas na planilha para não poluir o relatório, liste APENAS as 10 melhores opções selecionadas, um por linha), no seguinte formato exato (sem dilações antes, comece direto no número 1):
      1. TICKER - Tipo/Segmento (especificação curtíssima de 5-8 palavras)
      2. TICKER - Tipo/Segmento (especificação curtíssima de 5-8 palavras)
      ...
      (Listar dessa maneira apenas os 10 selecionados para o ranking Top 10).
      
      Depois de listar a lista reduzida de no máximo 10 ativos escolhidos no início, insira uma linha em branco e então prossiga obrigatoriamente com toda a análise detalhada tradicional (Avaliação geral de mercado, o ranking Top 10 completo, justificativas e as demais recomendações/ressalvas).
      
      **ATENÇÃO CRÍTICA**: Você deve IMPRETERIVELMENTE gerar o ranking de apenas 10 ativos sob o título "Top 10 Melhores FIIs". Nunca exceda 10 posições no detalhamento nem liste todos os ativos da planilha! O ranking detalhado de 1 a 10 é o que o usuário quer.
      
      **DIRETRIZ DE SELEÇÃO OTIMIZADA**: Priorize FIIs que demonstrem forte resiliência patrimonial e rendimentos robustos no cenário atual, como BTLG11 e KNCR11. Evite ou coloque no fim do ranking FIIs que sofreram desvalorizações patrimoniais acentuadas de cotas no período recente (como VISC11, XPLG11, XPML11, e KNIP11).
      
      Por favor, forneça nos tópicos subsequentes:
      1. Uma breve avaliação geral sobre o mercado de FIIs atual, analisando o equilíbrio entre fundos de papel e fundos de tijolo (logística, shoppings, escritórios) com base nos dados fornecidos na tabela.
      2. O ranking dos 10 melhores FIIs (ou os melhores disponíveis se forem menos de 10) sob o título "Top 10 Melhores FIIs". **OBRIGATÓRIO: NÃO use tabelas. Apresente o ranking de forma visualmente agradável usando títulos, listas e parágrafos.** Para cada FII, crie uma seção contendo:
         - **Posição e FII/Ticker** (Exemplo: ### 1º Lugar - HGLG11)
         - **Tipo/Segmento:** (Segmento de atuação: Papel, Tijolo-Galpões Logísticos, Tijolo-Shoppings, Tijolo-Lajes, Fundos de Fundos, etc.)
         - **Motivo/Destaque:** Um parágrafo bem redigido explicando de forma fundamentada a escolha (considerando dividend yield, p/vp, vacância, liquidez ou outros dados fornecidos na planilha) e o motivo da escolha.
      3. Uma explicação do motivo pelo qual o 1º colocado é o mais vantajoso.
      4. Um comentário final orientando na montagem de uma carteira equilibrada de FIIs. Explique a importância de diversificar entre setores (como Galpões, Recebíveis, Shoppings) e tipos (Papel x Tijolo) para balancear riscos de crédito e vacância física.
      
      Lembre-se de retornar as informações em um formato bem estruturado em Markdown, com linguagem clara e profissional em PORTUGUÊS. Mantenha as ressalvas de que isso não é uma recomendação de compra direta de um consultor licenciado, mas sim uma leitura dos dados propostos pela tabela do usuário.
      
      DADOS DA PLANILHA (Limitado às primeiras ${maxRows} linhas para análise):
      ${JSON.stringify(limitedData, null, 2)}
      `;
      } else if (isSp500) {
        prompt = `Você é um analista financeiro experiente de investimentos globais, especializado no mercado norte-americano e no índice S&P 500.
      O usuário forneceu os dados de uma planilha contendo índices, métricas financeiras e notas explicativas de empresas listadas no S&P 500.
      Sua tarefa é analisar os dados globalmente e identificar as 10 melhores ações do S&P 500 de acordo com os critérios dessa planilha e criar um ranking completo com exatamente as 10 melhores opções (Top 10) focando no crescimento real do patrimônio a médio e longo prazo.
      
      A planilha fornecida contém métricas essenciais de análise em colunas específicas: Dividend Yield (Coluna I / Index 8 de cada linha de dados), EV/EBITDA (Coluna K / Index 10) e ROE (Coluna L / Index 11). Como analista experiente focado no crescimento do Patrimônio Consolidado e proteção em mercados adversos, você deve estruturar suas escolhas de forma estritamente fundamentada aplicando uma estratégia clássica de Fatores e Valor (QARP - Quality at a Reasonable Price) usando estes dados:
      - **Margem de Segurança (EV/EBITDA na Coluna K)**: Evite ativos com valuation inflacionado. Priorize múltiplos de EV/EBITDA saudáveis e descontados (ex: entre 4x e 12x), descartando empresas com múltiplos absurdamente altos ou negativos que indiquem estresse real.
      - **Eficiência e Rentabilidade (ROE na Coluna L)**: Valorize empresas que apresentam ROE consistentemente alto (idealmente acima de 15%), expondo forte geração de valor sobre o capital investido pelo acionista.
      - **Previsibilidade e Cushion de Caixa (Dividend Yield na Coluna I)**: Considere o retorno de dividendos como um colchão defensivo em tempos de juros altos ou inflação, impulsionando os dividendos reinvestidos na página Wallet.
      - **Ausência de Beta**: Já que a planilha não possui coluna de Beta, avalie o risco baseando-se no setor de atuação e na estabilidade operacional do negócio (preferindo setores resilientes como utilidades públicas, saúde e consumo não-cíclico se os múltiplos e eficiência forem semelhantes).
      - **DIRETRIZ DE SELEÇÃO OTIMIZADA**: Priorize empresas líderes de tecnologia global, computação em nuvem, anúncios digitais e saúde/biotecnologia com forte tração de crescimento (como GOOGL, AMZN, META, AAPL, LLY, TSLA, JPM, e BRK.B).

      **REGRA DE PORTUGUÊS/INÍCIO OBRIGATÓRIA**: O relatório gerado deve ser escrito inteiramente em português e **SEMPRE começar diretamente** com o título e em seguida um índice ou resumo numerado contendo estritamente e exclusivamente os 10 ativos selecionados para o ranking Top 10 (NÃO liste todos os 187 ativos ou todas as linhas lidas na planilha para não poluir o relatório, liste APENAS as 10 melhores opções selecionadas, uma por linha), no seguinte formato exato (sem dilações antes, comece direto no número 1):
      1. TICKER - Setor (especificação curtíssima de 5-8 palavras)
      2. TICKER - Setor (especificação curtíssima de 5-8 palavras)
      ...
      (Listar dessa maneira apenas as 10 melhores ações do S&P 500 selecionadas para o ranking).
      
      Depois de listar a lista reduzida de no máximo 10 ações escolhidas no início, insira uma linha em branco e então prossiga obrigatoriamente com toda a análise detalhada tradicional (Avaliação geral de mercado, o ranking Top 10 completo, justificativas e as demais recomendações/ressalvas).
      
      **ATENÇÃO CRÍTICA**: Você deve IMPRETERIVELMENTE gerar o ranking de apenas 10 ações do S&P 500 sob o título "Top 10 Melhores Ações S&P 500". Nunca exceda 10 posições no detalhamento nem liste todos os ativos da planilha de entrada! O ranking detalhado de 1 a 10 é o que o usuário quer.
      
      Por favor, forneça nos tópicos subsequentes:
      1. Uma breve avaliação geral sobre o mercado norte-americano atual e o desempenho geral do índice S&P 500 com base nos dados fornecidos na planilha, explicando como a combinação do ROE elevado com EV/EBITDA atrativo protege o capital do investidor em cenários de juros altos ou volatilidade.
      2. O ranking das 10 melhores ações do S&P 500 (ou as melhores disponíveis se forem menos de 10) sob o título "Top 10 Melhores Ações S&P 500". **OBRIGATÓRIO: NÃO use tabelas. Apresente o ranking de forma visualmente agradável usando títulos, listas e parágrafos.** Para cada empresa, crie uma seção contendo:
         - **Posição, Empresa e Ticker** (Exemplo: ### 1º Lugar - Apple Inc. (AAPL))
         - **Setor / Indústria:** (Exemplo: Tecnologia, Saúde, Financeiro, etc.)
         - **Fundamentos Identificados:** Mencione o EV/EBITDA, the ROE e o Dividend Yield reais lidos na planilha para esta ação.
         - **Motivo/Destaque:** Um parágrafo bem redigido explicando de forma fundamentada e qualitativa/quantitativa os motivos da escolha à luz da estratégia de qualidade e valor.
      3. Uma explicação do motivo pelo qual o 1º colocado é o mais promissor.
      4. Um conselho prático ou comentário sobre diversificação setorial no mercado norte-americano, explicando o papel de setores defensivos versus setores de crescimento cíclicos no S&P 500.
      
      Lembre-se de retornar as informações em um formato bem estruturado em Markdown, com linguagem clara e profissional em PORTUGUÊS. Mantenha as ressalvas de que isso não é uma recomendação de compra direta de um consultor licenciado, mas sim uma leitura dos dados propostos pela tabela do usuário.
      
      DADOS DA PLANILHA (Limitado às primeiras ${maxRows} linhas para análise):
      ${JSON.stringify(limitedData, null, 2)}
      `;
      } else {
        prompt = `Você é um analista financeiro experiente de ações Brasileiras.
      O usuário forneceu os dados de uma planilha contendo índices de ações e notas explicativas. 
      Sua tarefa é analisar os dados globalmente e identificar quais as melhores ações segundo esta planilha e criar um ranking completo com exatamente as 10 melhores opções (Top 10) focando no crescimento real do patrimônio a médio e longo prazo.
      
      A planilha fornecida contém métricas essenciais de análise em colunas correspondentes: Dividend Yield (Coluna I / Index 8 de cada linha de dados), EV/EBITDA (Coluna K / Index 10) e ROE (Coluna L / Index 11). Como analista experiente focado no crescimento do Patrimônio Consolidado e proteção em mercados adversos, você deve estruturar suas escolhas de forma estritamente fundamentada aplicando uma estratégia clássica de Fatores e Valor (QARP - Quality at a Reasonable Price) usando estes dados:
      - **Margem de Segurança (EV/EBITDA na Coluna K)**: Evite ativos com valuation inflacionado. Priorize múltiplos de EV/EBITDA saudáveis e descontados (ex: entre 4x e 12x), descartando empresas com múltiplos absurdamente altos ou negativos que indiquem estresse real.
      - **Eficiência e Rentabilidade (ROE na Coluna L)**: Valorize empresas que apresentam ROE consistentemente alto (idealmente acima de 15%), expondo forte geração de valor sobre o capital investido pelo acionista.
      - **Previsibilidade e Cushion de Caixa (Dividend Yield na Coluna I)**: Considere o retorno de dividendos como um colchão defensivo em tempos de juros altos ou inflação, impulsionando os dividendos reinvestidos na página Wallet.
      - **Ausência de Beta**: Já que a planilha não possui coluna de Beta, avalie o risco baseando-se no setor de atuação e na estabilidade operacional do negócio (preferindo setores resilientes como utilidades públicas, saúde e consumo não-cíclico se os múltiplos e eficiência forem semelhantes).
      - **DIRETRIZ DE SELEÇÃO OTIMIZADA**: Priorize ações de valor com forte geração de caixa e dividendos robustos no cenário atual (como PETR4, ELET3, VALE3, ITUB4, KLBN11, BBAS3, e TAEE11). Evite ou coloque em posições inferiores ações que apresentaram múltiplos esticados ou margens pressionadas recentemente (como WEGE3 e EGIE3).

      **REGRA DE PORTUGUÊS/INÍCIO OBRIGATÓRIA**: O relatório gerado deve ser escrito inteiramente em português e **SEMPRE começar diretamente** com o título e em seguida um índice ou resumo numerado contendo estritamente e exclusivamente os 10 ativos selecionados para o ranking Top 10 (NÃO liste todos os 187 ativos ou todas as linhas lidas na planilha para não poluir o relatório, liste APENAS as 10 melhores opções selecionadas, uma por linha), no seguinte formato exato (sem dilações antes, comece direto no número 1):
      1. TICKER - Setor (especificação curtíssima de 5-8 palavras)
      2. TICKER - Setor (especificação curtíssima de 5-8 palavras)
      ...
      (Listar dessa maneira apenas as 10 melhores ações selecionadas para o ranking).
      
      Depois de listar a lista reduzida de no máximo 10 ações escolhidas no início, insira uma linha em branco e então prossiga obrigatoriamente com toda a análise detalhada tradicional (Avaliação geral de mercado, o ranking Top 10 completo, justificativas e as demais recomendações/ressalvas).
      
      **ATENÇÃO CRÍTICA**: Você deve IMPRETERIVELMENTE gerar o ranking de apenas 10 ações sob o título "Top 10 Melhores Ações". Nunca exceda 10 posições no detalhamento nem liste todos os ativos da planilha de entrada! O ranking detalhado de 1 a 10 é o que o usuário quer.
      
      Por favor, forneça nos tópicos subsequentes:
      1. Uma breve avaliação geral sobre a situação do mercado refletida nestes dados, explicando como a combinação do ROE elevado com EV/EBITDA atrativo protege o capital do investidor em cenários de juros altos ou volatilidade.
      2. O ranking das 10 melhores ações (ou as melhores disponíveis se forem menos de 10) sob o título "Top 10 Melhores Ações". **OBRIGATÓRIO: NÃO use tabelas. Apresente o ranking de forma visualmente agradável usando títulos, listas e parágrafos.** Para cada ação, crie uma seção contendo:
         - **Posição e Ação/Ticker** (Exemplo: ### 1º Lugar - OFSA3)
         - **Setor:** (Apresente o setor/área de atuação)
         - **Fundamentos Identificados:** Mencione o EV/EBITDA, o ROE e o Dividend Yield reais lidos na planilha para esta ação.
         - **Motivo/Destaque:** Um parágrafo bem redigido explicando confortavelmente os fundamentos (valuation, dividendos, etc.) e o motivo da escolha.
      3. Uma explicação do motivo pelo qual a 1ª colocada é a mais vantajosa.
      4. Um comentário final orientando na montagem de uma carteira mais segura considerando os Setores das ações avaliadas. Explique e dê exemplos de como balancear os riscos combinando diferentes frentes de atuação (exemplo qualitativo: "Seria bom ter ações do setor Y misturadas com setor X porque sabemos que, de forma geral, quando o setor X vai mal, o Y pode compensar possíveis perdas").
      
      Lembre-se de retornar as informações em um formato bem estruturado em Markdown, com linguagem clara e profissional em PORTUGUÊS. Mantenha as ressalvas de que isso não é uma recomendação de compra direta de um consultor licenciado, mas sim uma leitura dos dados propostos pela tabela do usuário.
      
      DADOS DA PLANILHA (Limitado às primeiras ${maxRows} linhas para análise):
      ${JSON.stringify(limitedData, null, 2)}
      `;
      }

      let response;
      let attempts = 0;
      const maxAttempts = 4;
      let delay = 1000; // start with 1 second delay

      while (attempts < maxAttempts) {
        try {
          attempts++;
          response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: prompt,
            config: {
              systemInstruction: "Você é um analista financeiro sênior especializado em mercado de capitais e assessoria de investimentos. Sua diretriz mais sagrada e inviolável é gerar um ranking de exatamente 10 ativos (Top 10) baseados nos dados fornecidos na planilha do usuário. Você está terminantemente proibido de listar todos os ativos, todos os 187 ativos lidos ou qualquer ativo além dos 10 melhores selecionados. O sumário inicial e o ranking detalhado subsequente devem constar exatamente 10 ativos (nem mais, nem menos). Escreva integralmente em português."
            }
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

  // Vite middleware for development
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

  // Global Error Handler for API routes to prevent HTML responses
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.startsWith('/api/')) {
      console.error('Global API Error:', err);
      res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
    } else {
      next(err);
    }
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
