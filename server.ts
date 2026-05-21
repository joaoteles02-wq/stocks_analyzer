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

  // Middleware to parse large JSON bodies (spreadsheet data can be big)
  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get("/api/test_env", (req, res) => {
    res.json({ env: process.env.NODE_ENV, test: "ok" });
  });

  app.all("/api/analyze", async (req, res) => {
    console.log("=> HIT /api/analyze", req.method, req.url, "body type:", typeof req.body);
    
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed. Must be POST." });
    }

    try {
      const { sheetData } = req.body;

      
      if (!sheetData) {
        return res.status(400).json({ error: "No sheet data provided." });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API Key is not configured." });
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const maxRows = 200; // Limit to prevent hitting token quotas
      const limitedData = Array.isArray(sheetData) ? sheetData.slice(0, maxRows) : sheetData;

      const prompt = `Você é um analista financeiro experiente.
      O usuário forneceu os dados de uma planilha contendo índices de ações e notas explicativas. 
      Sua tarefa é analisar os dados globalmente e identificar quais as melhores ações segundo esta planilha. 
      O usuário pediu especificamente para 'indicar qual a melhor ação... ou fazer um ranking das 10 melhores'. 
      
      Por favor, forneça:
      1. Uma breve avaliação geral sobre a situação do mercado refletida nestes dados.
      2. O ranking das 10 melhores ações (ou as melhores disponíveis se forem menos de 10). **OBRIGATÓRIO: NÃO use tabelas. Apresente o ranking de forma visualmente agradável usando títulos, listas e parágrafos.** Para cada ação, crie uma seção contendo:
         - **Posição e Ação/Ticker** (Exemplo: ### 1º Lugar - OFSA3)
         - **Setor:** (Apresente o setor/área de atuação)
         - **Motivo/Destaque:** Um parágrafo bem redigido explicando confortavelmente os fundamentos (valuation, dividendos, etc.) e o motivo da escolha.
      3. Uma explicação do motivo pelo qual a 1ª colocada é a mais vantajosa.
      4. Um comentário final orientando na montagem de uma carteira mais segura considerando os Setores das ações avaliadas. Explique e dê exemplos de como balancear os riscos combinando diferentes frentes de atuação (exemplo qualitativo: "Seria bom ter ações do setor Y misturadas com setor X porque sabemos que, de forma geral, quando o setor X vai mal, o Y pode compensar possíveis perdas").
      
      Lembre-se de retornar as informações em um formato bem estruturado em Markdown, com linguagem clara e profissional. Mantenha as ressalvas de que isso não é uma recomendação de compra direta de um consultor licenciado, mas sim uma leitura dos dados propostos pela tabela do usuário.
      
      DADOS DA PLANILHA (Limitado às primeiras ${maxRows} linhas para análise):
      ${JSON.stringify(limitedData, null, 2)}
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

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
