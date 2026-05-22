import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import cors from "cors";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Add CORS to allow external frontends (e.g. GitHub Pages) to hit this API
  app.use(cors({ origin: "*" }));
  app.options("*", cors());

  // Middleware to parse large JSON bodies (spreadsheet data can be big)
  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get("/api/test_env", (req, res) => {
    res.json({ env: process.env.NODE_ENV, test: "ok" });
  });

  app.post("/api/wallet-insight", async (req, res) => {
    try {
      const { wallet } = req.body;
      if (!wallet || !Array.isArray(wallet)) {
        return res.status(400).json({ error: "Dados da carteira inválidos." });
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

  app.all("/api/process-data", async (req, res) => {
    console.log("=> HIT /api/process-data", req.method, req.url);
    
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed. Must be POST." });
    }

    try {
      const { sheetData, token, spreadsheetId, sheetName, analysisType } = req.body;

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
      Sua tarefa é analisar os dados globalmente e identificar quais os melhores FIIs segundo esta planilha.
      O usuário pediu especificamente para fazer um ranking dos 10 melhores FIIs do mercado brasileiro segundo os critérios indicados na tabela.
      
      Por favor, forneça:
      1. Uma breve avaliação geral sobre o mercado de FIIs atual, analisando o equilíbrio entre fundos de papel e fundos de tijolo (logística, shoppings, escritórios) com base nos dados fornecidos na tabela.
      2. O ranking dos 10 melhores FIIs (ou os melhores disponíveis se forem menos de 10) sob o título "Top 10 the best FII's". **OBRIGATÓRIO: NÃO use tabelas. Apresente o ranking de forma visualmente agradável usando títulos, listas e parágrafos.** Para cada FII, crie uma seção contendo:
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
      Sua tarefa é analisar os dados globalmente e identificar quais as melhores ações do S&P 500 de acordo com os critérios dessa planilha.
      O usuário pediu especificamente para fazer um ranking das 10 melhores ações do S&P 500 sob o título "Top 10 the best S&P 500".
      
      Por favor, forneça:
      1. Uma breve avaliação geral sobre o mercado norte-americano atual e o desempenho geral do índice S&P 500 com base nos dados fornecidos na planilha.
      2. O ranking das 10 melhores ações do S&P 500 (ou as melhores disponíveis se forem menos de 10) sob o título "Top 10 the best S&P 500". **OBRIGATÓRIO: NÃO use tabelas. Apresente o ranking de forma visualmente agradável usando títulos, listas e parágrafos.** Para cada empresa, crie uma seção contendo:
         - **Posição, Empresa e Ticker** (Exemplo: ### 1º Lugar - Apple Inc. (AAPL))
         - **Setor / Indústria:** (Exemplo: Tecnologia, Saúde, Financeiro, etc.)
         - **Motivo/Destaque:** Um parágrafo bem redigido explicando de forma fundamentada e qualitativa/quantitativa os motivos da escolha (relação P/E, crescimento de receita, margens, dividendos ou outras métricas que estejam presentes nos dados).
      3. Uma explicação do motivo pelo qual o 1º colocado é o mais promissor.
      4. Um conselho prático ou comentário sobre diversificação setorial no mercado norte-americano, explicando o papel de setores defensivos versus setores de crescimento cíclicos no S&P 500.
      
      Lembre-se de retornar as informações em um formato bem estruturado em Markdown, com linguagem clara e profissional em PORTUGUÊS. Mantenha as ressalvas de que isso não é uma recomendação de compra direta de um consultor licenciado, mas sim uma leitura dos dados propostos pela tabela do usuário.
      
      DADOS DA PLANILHA (Limitado às primeiras ${maxRows} linhas para análise):
      ${JSON.stringify(limitedData, null, 2)}
      `;
      } else {
        prompt = `Você é um analista financeiro experiente de ações.
      O usuário forneceu os dados de uma planilha contendo índices de ações e notas explicativas. 
      Sua tarefa é analisar os dados globalmente e identificar quais as melhores ações segundo esta planilha. 
      O usuário pediu especificamente para 'indicar qual a melhor ação... ou fazer um ranking das 10 melhores' sobre o título "Top 10 the best Stocks".
      
      Por favor, forneça:
      1. Uma breve avaliação geral sobre a situação do mercado refletida nestes dados.
      2. O ranking das 10 melhores ações (ou as melhores disponíveis se forem menos de 10). **OBRIGATÓRIO: NÃO use tabelas. Apresente o ranking de forma visualmente agradável usando títulos, listas e parágrafos.** Para cada ação, crie uma seção contendo:
         - **Posição e Ação/Ticker** (Exemplo: ### 1º Lugar - OFSA3)
         - **Setor:** (Apresente o setor/área de atuação)
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
            contents: prompt
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
