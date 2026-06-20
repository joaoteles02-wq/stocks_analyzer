import { useState, useEffect } from 'react';
import Markdown from 'react-markdown';
import { 
  Wallet, 
  Coins, 
  TrendingUp, 
  Globe, 
  Percent, 
  Briefcase, 
  RotateCcw, 
  Sparkles, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  Sliders, 
  RefreshCw,
  HelpCircle
} from 'lucide-react';
import { pushWalletConfig } from '../lib/sync';
 
export interface Asset {
  ticker: string;
  name: string;
  type: 'stocks' | 'fii' | 'sp500';
  price: number; // Price in original currency
  currency: 'BRL' | 'USD';
  yield: number; // e.g., 0.11 or 0.08
  sector: string;
  description: string;
}

export const ALL_BEST_30_ASSETS: Asset[] = [
  // Ações brasileiras (10)
  { ticker: 'VALE3', name: 'Vale S.A.', type: 'stocks', price: 62.50, currency: 'BRL', yield: 0.082, sector: 'Mineração e Siderurgia', description: 'Uma das maiores mineradoras globais, líder em receita e excelente pagadora de dividendos.' },
  { ticker: 'PETR4', name: 'Petrobras S.A.', type: 'stocks', price: 38.20, currency: 'BRL', yield: 0.145, sector: 'Petróleo e Gás', description: 'Líder nacional de refino e exploração de petróleo offshore de águas profundas (Pré-sal).' },
  { ticker: 'ITUB4', name: 'Itaú Unibanco Holding S.A.', type: 'stocks', price: 33.40, currency: 'BRL', yield: 0.058, sector: 'Financeiro', description: 'Maior banco privado brasileiro com alta rentabilidade consistente e governança exemplar.' },
  { ticker: 'BBAS3', name: 'Banco do Brasil S.A.', type: 'stocks', price: 27.10, currency: 'BRL', yield: 0.098, sector: 'Financeiro', description: 'Banco com forte atuação no agronegócio e excelente retorno histórico sobre patrimônio (ROE).' },
  { ticker: 'WEGE3', name: 'Weg S.A.', type: 'stocks', price: 42.60, currency: 'BRL', yield: 0.018, sector: 'Bens de Capital', description: 'Gigante multinacional de fabricação de motores elétricos, geradores e automação industrial.' },
  { ticker: 'EGIE3', name: 'Engie Brasil Energia S.A.', type: 'stocks', price: 44.15, currency: 'BRL', yield: 0.076, sector: 'Utilidade Pública', description: 'Maior geradora privada de energia 100% limpa do país, referência sob critérios ESG.' },
  { ticker: 'ABEV3', name: 'Ambev S.A.', type: 'stocks', price: 12.80, currency: 'BRL', yield: 0.055, sector: 'Consumo Não-Cíclico', description: 'Líder absoluta do mercado de bebidas latinas com fortíssima geração de caixa operacional.' },
  { ticker: 'ELET3', name: 'Eletrobras S.A.', type: 'stocks', price: 39.50, currency: 'BRL', yield: 0.035, sector: 'Utilidade Pública', description: 'Potência privatizada de geração e transmissão de energia térmica e hidroelétrica nacional.' },
  { ticker: 'KLBN11', name: 'Klabin S.A.', type: 'stocks', price: 21.30, currency: 'BRL', yield: 0.065, sector: 'Materiais Básicos', description: 'Maior produtora e exportadora de papéis para embalagens e celulose de alta eficiência.' },
  { ticker: 'TAEE11', name: 'Taesa S.A.', type: 'stocks', price: 35.80, currency: 'BRL', yield: 0.095, sector: 'Utilidade Pública', description: 'Referência em transmissão de energia elétrica com contratos longos de receita previsível.' },

  // FIIs (10)
  { ticker: 'MXRF11', name: 'Maxi Renda FII', type: 'fii', price: 10.15, currency: 'BRL', yield: 0.118, sector: 'Papel (Recebíveis)', description: 'Fundo imobiliário com maior número de cotistas focado em certificados de recebíveis imobiliários.' },
  { ticker: 'HGLG11', name: 'Cshg Logística FII', type: 'fii', price: 165.20, currency: 'BRL', yield: 0.084, sector: 'Tijolo (Logística)', description: 'Referência de excelência na gestão ativa de galpões logísticos de alto padrão construtivo.' },
  { ticker: 'XPML11', name: 'XP Malls FII', type: 'fii', price: 112.40, currency: 'BRL', yield: 0.089, sector: 'Tijolo (Shoppings)', description: 'Portfólio resiliente focado em participações robustas de shopping centers premium em capitais.' },
  { ticker: 'KNIP11', name: 'Kinea Índices de Preços FII', type: 'fii', price: 94.60, currency: 'BRL', yield: 0.102, sector: 'Papel (Recebíveis)', description: 'Fundo destinado a investidores qualificados focado em CRIs indexados à inflação (IPCA).' },
  { ticker: 'KNCR11', name: 'Kinea Rendimentos Imobiliários FII', type: 'fii', price: 102.30, currency: 'BRL', yield: 0.112, sector: 'Papel (Recebíveis)', description: 'Fundo gerido pela Kinea focado em CRIs atrelados à taxa CDI com baixo risco de inadimplência.' },
  { ticker: 'XPLG11', name: 'XP Log FII', type: 'fii', price: 98.70, currency: 'BRL', yield: 0.085, sector: 'Tijolo (Logística)', description: 'Fundo ativo em galpões logísticos estrategicamente localizados no sudeste brasileiro.' },
  { ticker: 'BTLG11', name: 'BTG Pactual Logística FII', type: 'fii', price: 101.90, currency: 'BRL', yield: 0.088, sector: 'Tijolo (Logística)', description: 'Fundo de logística robusto com locatários de alto escalão do e-commerce nacional.' },
  { ticker: 'VISC11', name: 'Vinci Shopping Centers FII', type: 'fii', price: 114.20, currency: 'BRL', yield: 0.082, sector: 'Tijolo (Shoppings)', description: 'Excelente portfólio de shoppings gerido ativamente pela Vinci Partners.' },
  { ticker: 'HGBS11', name: 'Hedge Brasil Shopping FII', type: 'fii', price: 215.10, currency: 'BRL', yield: 0.081, sector: 'Tijolo (Shoppings)', description: 'Fundo pioneiro no segmento de shoppings com imóveis consolidados há mais de uma década.' },
  { ticker: 'ALZR11', name: 'Alianza Trust Renda Imobiliária FII', type: 'fii', price: 116.45, currency: 'BRL', yield: 0.083, sector: 'Híbrido (Contratos Atípicos)', description: 'Fundo voltado ao desenvolvimento de contratos atípicos (Built-to-Suit / Sale-Leaseback) estáveis.' },

  // S&P 500 (10)
  { ticker: 'AAPL', name: 'Apple Inc.', type: 'sp500', price: 182.30, currency: 'USD', yield: 0.005, sector: 'Tecnologia / Hardware', description: 'Titã global em eletrônicos de consumo premium, ecossistema iOS e receita recorrente de serviços.' },
  { ticker: 'MSFT', name: 'Microsoft Corp.', type: 'sp500', price: 415.50, currency: 'USD', yield: 0.007, sector: 'Tecnologia / Software', description: 'Líder em computação na nuvem híbrida (Azure), software corporativo e inteligência artificial.' },
  { ticker: 'NVDA', name: 'Nvidia Corp.', type: 'sp500', price: 910.20, currency: 'USD', yield: 0.001, sector: 'Tecnologia / Semicondutores', description: 'Líder no fornecimento de chips gráficos de processamento profundo para data centers e IA.' },
  { ticker: 'AMZN', name: 'Amazon.com Inc.', type: 'sp500', price: 180.12, currency: 'USD', yield: 0.000, sector: 'E-Commerce / Cloud', description: 'Gigante pioneira do comércio eletrônico mundial e provedora de infraestrutura de nuvem AWS.' },
  { ticker: 'GOOGL', name: 'Alphabet Inc.', type: 'sp500', price: 172.50, currency: 'USD', yield: 0.005, sector: 'Tecnologia / Anúncios', description: 'Liderança inconteste em pesquisas de internet, Youtube, Android e ecossistema de anúncios.' },
  { ticker: 'META', name: 'Meta Platforms Inc.', type: 'sp500', price: 475.40, currency: 'USD', yield: 0.004, sector: 'Redes Sociais', description: 'Proprietária do Facebook, Instagram e Whatsapp, pioneira em redes e anúncios sociais.' },
  { ticker: 'TSLA', name: 'Tesla Inc.', type: 'sp500', price: 178.20, currency: 'USD', yield: 0.000, sector: 'Automotivo / Energia', description: 'Líder global e pioneira absoluta no desenvolvimento de carros elétricos autônomos e baterias.' },
  { ticker: 'BRK.B', name: 'Berkshire Hathaway Inc.', type: 'sp500', price: 405.10, currency: 'USD', yield: 0.000, sector: 'Hegemonia Global (Multiconglomerado)', description: 'Veículo de investimento do lendário Warren Buffett composto por seguradoras e marcas resilientes.' },
  { ticker: 'JPM', name: 'JPMorgan Chase & Co.', type: 'sp500', price: 195.30, currency: 'USD', yield: 0.024, sector: 'Financeiro', description: 'O maior banco dos Estados Unidos com balanço patrimonial ultra-resistente (fortaleza).' },
  { ticker: 'LLY', name: 'Eli Lilly and Company', type: 'sp500', price: 780.40, currency: 'USD', yield: 0.006, sector: 'Saúde / Biotecnologia', description: 'Gigante da saúde e biofarma responsável por tratamentos globais revolucionários de emagrecimento.' }
];

// 10 Balanced default assets: 3 Stocks BR, 3 FII, 4 S&P 500
const DEFAULT_WALLET_SLOTS: { assetTicker: string; weight: number }[] = [
  { assetTicker: 'GOOGL', weight: 20 },
  { assetTicker: 'AMZN', weight: 20 },
  { assetTicker: 'META', weight: 15 },
  { assetTicker: 'AAPL', weight: 10 },
  { assetTicker: 'PETR4', weight: 10 },
  { assetTicker: 'LLY', weight: 5 },
  { assetTicker: 'ELET3', weight: 5 },
  { assetTicker: 'VALE3', weight: 5 },
  { assetTicker: 'ITUB4', weight: 5 },
  { assetTicker: 'BTLG11', weight: 5 },
];

export function WalletView() {
  const USD_BRL_RATE = 5.15; // Simulated dollar exchange rate for realistic calculations

  const [wallet, setWallet] = useState<{ asset: Asset; weight: number }[]>(() => {
    // Attempt full local storage load first
    const savedFull = localStorage.getItem('saved_interactive_wallet_full');
    if (savedFull) {
      try {
        const parsed = JSON.parse(savedFull);
        if (Array.isArray(parsed) && parsed.length === 10) {
          return parsed;
        }
      } catch (e) {
        console.error('Failed to parse full saved wallet:', e);
      }
    }

    // Attempt backup/compact local storage load
    const saved = localStorage.getItem('saved_interactive_wallet');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 10) {
          // Map back to current Asset database object securely
          return parsed.map((item: any) => {
            const staticAsset = ALL_BEST_30_ASSETS.find(a => a.ticker === item.ticker);
            return {
              asset: staticAsset || ALL_BEST_30_ASSETS.find(a => a.ticker === 'ITUB4')!,
              weight: item.weight
            };
          });
        }
      } catch (e) {
        console.error('Failed to parse saved wallet:', e);
      }
    }

    // Default Fallback mapping
    return DEFAULT_WALLET_SLOTS.map(slot => {
      const matched = ALL_BEST_30_ASSETS.find(a => a.ticker === slot.assetTicker)!;
      return { asset: matched, weight: slot.weight };
    });
  });

  const [investmentBudget, setInvestmentBudget] = useState<number>(() => {
    const saved = localStorage.getItem('saved_wallet_budget');
    if (saved) {
      const parsed = Number(saved);
      if (parsed === 25000) {
        localStorage.setItem('saved_wallet_budget', '125000');
        return 125000;
      }
      return parsed;
    }
    return 125000;
  });

  const [activeReplaceIndex, setActiveReplaceIndex] = useState<number | null>(null);
  const [aiReport, setAiReport] = useState<string | null>(() => {
    return localStorage.getItem('saved_wallet_ai_report') || null;
  });
  const [loadingAi, setLoadingAi] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const hasStocksAnalysis = typeof window !== 'undefined' && !!localStorage.getItem('stocks_analysis_result');
  const hasFiiAnalysis = typeof window !== 'undefined' && !!localStorage.getItem('fii_analysis_result');
  const hasSp500Analysis = typeof window !== 'undefined' && !!localStorage.getItem('sp500_analysis_result');

  const [isReloadModalOpen, setIsReloadModalOpen] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<'renda' | 'equilibrada' | 'crescimento'>('equilibrada');
  const [activeStrategy, setActiveStrategy] = useState<'renda' | 'equilibrada' | 'crescimento'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('active_strategy') as any) || 'equilibrada';
    }
    return 'equilibrada';
  });

  // Parses the 10 ranked assets for a given type, using reports if available, falling back to static/definitions to get exactly 10
  const getRankedAssetsFromCategory = (type: 'stocks' | 'fii' | 'sp500'): Asset[] => {
    const rawMarkdown = localStorage.getItem(`${type}_analysis_result`);
    const parsedTickers: string[] = [];

    // Helper to filter out common financial acronyms we don't want to parse as US tickers
    const ignoreList = new Set([
      'TOP', 'ROE', 'EBITDA', 'PVP', 'PV', 'P/VP', 'FII', 'FIIS', 'ACOES', 'S&P', 'EV', 'DY', 'CDI', 'IPCA', 
      'BRL', 'USD', 'MEI', 'PIX', 'DRE', 'IRPF', 'CEO', 'EUA', 'USA', 'II', 'III', 'IV', 'V', 
      'VI', 'VII', 'VIII', 'IX', 'X', 'DIVIDEND', 'YIELD', 'RENT', 'TAXA', 'DIVIDENDOS', 
      'VALOR', 'PRECO', 'GRAHAM', 'GRAHAN', 'PL', 'LPA', 'VPA', 'SETOR', 'DICAS', 'DICA'
    ]);

    const extractTickerFromLine = (line: string): string | null => {
      // 1. Clean markdown elements
      const cleanLine = line.replace(/[\*\_\#\-\+\•\=\:\(\)]/g, ' ').trim();
      
      // 2. Check for B3 stock patterns (4 letters + 1 or 2 digits)
      if (type === 'stocks' || type === 'fii') {
        const b3Match = cleanLine.match(/\b([A-Z]{4}\d{1,2})\b/);
        if (b3Match) {
          return b3Match[1].toUpperCase();
        }
      }

      // 3. For S&P500 or general, look for words inside original parentheses, e.g. "Apple Inc. (AAPL)"
      const parenMatch = line.match(/\(([A-Z]{1,5})\)/);
      if (parenMatch) {
        const t = parenMatch[1].toUpperCase();
        if (!ignoreList.has(t)) {
          return t;
        }
      }

      // 4. Split and verify each word
      const words = cleanLine.split(/[\s\-ºª\,]+/);
      for (const word of words) {
        const w = word.trim().toUpperCase();
        if (!w || /^\d+$/.test(w) || ignoreList.has(w)) continue;

        if (type === 'sp500') {
          // General US Tickers are 1-5 letters
          if (w.length >= 1 && w.length <= 5 && /^[A-Z]+$/.test(w)) {
            return w;
          }
        } else {
          // Brazilian Tickers are typically 3-6 chars (mostly letters and optionally numbers)
          if (w.length >= 3 && w.length <= 6 && /^[A-Z0-9]+$/.test(w)) {
            return w;
          }
        }
      }
      return null;
    };

    if (rawMarkdown) {
      const lines = rawMarkdown.split('\n');
      for (const line of lines) {
        // Checks if line is a potential ranking line or section heading
        const isRankingLine = 
          /^\s*[\-\*\+\#\s]*\d+[\.\)\º\ª\s\-]/i.test(line) || 
          /lugar|posição|ranking/i.test(line) ||
          /^\s*[\-\*\+]\s+/.test(line); // list bullet points

        if (isRankingLine) {
          const t = extractTickerFromLine(line);
          if (t && !parsedTickers.includes(t)) {
            parsedTickers.push(t);
          }
        }
      }

      // Fallback 1: If we have not found enough tickers, look for B3 patterns anywhere in the markdown
      if (parsedTickers.length < 5 && (type === 'stocks' || type === 'fii')) {
        const b3Matches = rawMarkdown.match(/\b([A-Z]{4}\d{1,2})\b/g);
        if (b3Matches) {
          for (const m of b3Matches) {
            const cleanM = m.toUpperCase();
            if (!ignoreList.has(cleanM) && !parsedTickers.includes(cleanM)) {
              parsedTickers.push(cleanM);
            }
          }
        }
      }

      // Fallback 2: For S&P 500, scan text to see if any of our known best S&P tickers is featured
      if (parsedTickers.length < 5 && type === 'sp500') {
        const knownSp500Tickers = ALL_BEST_30_ASSETS.filter(a => a.type === 'sp500').map(a => a.ticker);
        for (const kt of knownSp500Tickers) {
          if (rawMarkdown.toUpperCase().includes(kt) && !parsedTickers.includes(kt)) {
            parsedTickers.push(kt);
          }
        }
      }
    }

    let localRows: any[][] = [];
    try {
      const savedLocal = localStorage.getItem('local_uploaded_sheet_data');
      if (savedLocal) {
        localRows = JSON.parse(savedLocal);
      }
    } catch (e) {}

    // Carrega o índice customizado de coluna configurado pelo usuário para alinhamento uniforme
    const overrideInitialPriceColStr = localStorage.getItem('sheet_initial_price_col_idx');
    const overrideCurrentPriceColStr = localStorage.getItem('sheet_current_price_col_idx');
    const overrideInitialPriceColIdx = overrideInitialPriceColStr ? parseInt(overrideInitialPriceColStr, 10) : -1;
    const overrideCurrentPriceColIdx = overrideCurrentPriceColStr ? parseInt(overrideCurrentPriceColStr, 10) : -1;

    const parsePortNumber = (valStr: string): number => {
      if (!valStr) return NaN;
      let clean = valStr.replace('R$', '').replace('$', '').trim();
      if (clean.includes('.') && clean.includes(',')) {
        clean = clean.replace(/\./g, '').replace(',', '.');
      } else if (clean.includes(',')) {
        clean = clean.replace(',', '.');
      }
      return Number(clean);
    };

    const resultList: Asset[] = [];

    // Map found tickers to Asset objects
    for (const ticker of parsedTickers) {
      // 1. Initial baseline from ALL_BEST_30_ASSETS if exists
      const existing = ALL_BEST_30_ASSETS.find(a => a.ticker.toUpperCase() === ticker);
      let assetBase: Asset = existing ? { ...existing } : {
        ticker,
        name: `${type === 'stocks' ? 'Ação' : type === 'fii' ? 'Fundo Imobiliário' : 'Ação S&P 500'} ${ticker}`,
        type,
        price: type === 'sp500' ? 100.00 : 15.00,
        currency: type === 'sp500' ? 'USD' as const : 'BRL' as const,
        yield: type === 'sp500' ? 0.015 : type === 'fii' ? 0.10 : 0.06,
        sector: 'Selecionado por IA',
        description: 'Ativo adicionado automaticamente a partir da análise da planilha.'
      };

      // 2. Lookup and override from local sheet rows if available
      if (Array.isArray(localRows) && localRows.length > 0) {
        const matchedRow = localRows.find(row => 
          Array.isArray(row) && row.some(cell => {
            const s = String(cell).trim().toUpperCase();
            return s === ticker || s === `${ticker}.SA` || s.replace('.SA', '') === ticker;
          })
        );

        if (matchedRow) {
          // Identify headers
          const headerRow = localRows[0].map(cell => String(cell).trim().toLowerCase());
          
          let currentPriceColIndex = -1;
          let initialPriceColIndex = -1;
          let yieldColIndex = -1;
          
          for (let i = 0; i < headerRow.length; i++) {
            const h = headerRow[i];
            const isCurrent = h.includes('atual') || h.includes('hoje') || h.includes('agora') || h.includes('realtime') || h.includes('venda') || h.includes('cotação') || h.includes('cotacao') || h.includes('mercado');
            const isInitial = h.includes('02/01/2026') || h.includes('inicial') || h.includes('custo') || h.includes('compra') || h.includes('medio') || h.includes('médio') || h.includes('pago') || h.includes('aquisição') || h.includes('aquisicao') || h.includes('yoc') || h.includes('cost');
            const isYield = h.includes('yield') || h.includes('dy') || h.includes('dividendo');
            
            if (isCurrent && !isInitial) {
              currentPriceColIndex = i;
            } else if (isInitial && !isCurrent) {
              initialPriceColIndex = i;
            }
            if (isYield) {
              yieldColIndex = i;
            }
          }
          
          // Get name
          let matchedName = assetBase.name;
          for (const cell of matchedRow) {
            if (typeof cell === 'string' && cell.trim() && cell.toUpperCase() !== ticker && cell.toUpperCase() !== `${ticker}.SA` && isNaN(Number(cell.replace(',', '.')))) {
              matchedName = cell.trim();
              break;
            }
          }
          assetBase.name = matchedName;

          // Get Current Price (Preço Atual)
          let matchedPrice = assetBase.price;
          if (overrideCurrentPriceColIdx !== -1 && matchedRow[overrideCurrentPriceColIdx] !== undefined) {
            const num = parsePortNumber(String(matchedRow[overrideCurrentPriceColIdx]));
            if (!isNaN(num) && num > 0.1) {
              matchedPrice = num;
            }
          } else if (currentPriceColIndex !== -1 && matchedRow[currentPriceColIndex] !== undefined) {
            const num = parsePortNumber(String(matchedRow[currentPriceColIndex]));
            if (!isNaN(num) && num > 0.1) {
              matchedPrice = num;
            }
          } else {
            // Find numbers in the row
            const numbersInRow: number[] = [];
            for (let i = 0; i < matchedRow.length; i++) {
              const val = parsePortNumber(String(matchedRow[i]));
              if (!isNaN(val) && val > 0.1 && val < 50000) {
                numbersInRow.push(val);
              }
            }
            if (numbersInRow.length > 0) {
              if (numbersInRow.length >= 2) {
                // If we don't have explicit headers, we assume Current Price is the last valid number
                // because Current Price usually comes AFTER Preço de Custo/Initial in sheets.
                matchedPrice = numbersInRow[numbersInRow.length - 1];
              } else {
                matchedPrice = numbersInRow[0];
              }
            }
          }
          assetBase.price = matchedPrice;

          // Get Yield
          let matchedYield = assetBase.yield;
          if (yieldColIndex !== -1 && matchedRow[yieldColIndex] !== undefined) {
            const cleanVal = String(matchedRow[yieldColIndex]).replace('%', '').replace(',', '.').trim();
            const num = Number(cleanVal);
            if (!isNaN(num)) {
              matchedYield = num > 1 ? num / 100 : num;
            }
          } else if (matchedRow[8]) {
            const cleanVal = String(matchedRow[8]).replace('%', '').replace(',', '.').trim();
            const num = Number(cleanVal);
            if (!isNaN(num)) {
              matchedYield = num > 1 ? num / 100 : num;
            }
          }
          assetBase.yield = matchedYield;

          // Get Sector
          let matchedSector = assetBase.sector;
          if (matchedRow[2] && typeof matchedRow[2] === 'string' && matchedRow[2].length > 3) {
            matchedSector = matchedRow[2];
          }
          assetBase.sector = matchedSector;
          assetBase.description = 'Ativo atualizado com dados reais extraídos de sua planilha.';
        }
      }

      resultList.push(assetBase);
    }

    // Ensure we have exactly 10 by filling from the static list of that type
    const staticList = ALL_BEST_30_ASSETS.filter(a => a.type === type);
    for (const staticAsset of staticList) {
      if (resultList.length >= 10) break;
      if (!resultList.some(a => a.ticker === staticAsset.ticker)) {
        resultList.push(staticAsset);
      }
    }

    return resultList.slice(0, 10);
  };

  const getStrategyPreview = (strategyType: 'renda' | 'equilibrada' | 'crescimento'): { asset: Asset; weight: number }[] => {
    const stocksRanked = getRankedAssetsFromCategory('stocks');
    const fiiRanked = getRankedAssetsFromCategory('fii');
    const sp500Ranked = getRankedAssetsFromCategory('sp500');

    const selectedSlots: { asset: Asset; weight: number }[] = [];

    if (strategyType === 'renda') {
      // 5 FIIs (60%), 3 Ações BR (30%), 2 S&P 500 (10%)
      const selectedFiis = fiiRanked.slice(0, 5);
      const selectedStocks = stocksRanked.slice(0, 3);
      const selectedSp500 = sp500Ranked.slice(0, 2);

      const fiiWeights = [15, 15, 10, 10, 10];
      const stockWeights = [10, 10, 10];
      const sp500Weights = [5, 5];

      selectedFiis.forEach((asset, idx) => {
        selectedSlots.push({ asset, weight: fiiWeights[idx] || 10 });
      });
      selectedStocks.forEach((asset, idx) => {
        selectedSlots.push({ asset, weight: stockWeights[idx] || 10 });
      });
      selectedSp500.forEach((asset, idx) => {
        selectedSlots.push({ asset, weight: sp500Weights[idx] || 5 });
      });
    } else if (strategyType === 'crescimento') {
      // 5 S&P 500 (60%), 3 Ações BR (30%), 2 FIIs (10%)
      const selectedSp500 = sp500Ranked.slice(0, 5);
      const selectedStocks = stocksRanked.slice(0, 3);
      const selectedFiis = fiiRanked.slice(0, 2);

      const sp500Weights = [15, 15, 10, 10, 10];
      const stockWeights = [10, 10, 10];
      const fiiWeights = [5, 5];

      selectedSp500.forEach((asset, idx) => {
        selectedSlots.push({ asset, weight: sp500Weights[idx] || 10 });
      });
      selectedStocks.forEach((asset, idx) => {
        selectedSlots.push({ asset, weight: stockWeights[idx] || 10 });
      });
      selectedFiis.forEach((asset, idx) => {
        selectedSlots.push({ asset, weight: fiiWeights[idx] || 5 });
      });
    } else {
      // balanced: 4 FIIs (40%), 3 Ações BR (30%), 3 S&P 500 (30%)
      const selectedFiis = fiiRanked.slice(0, 4);
      const selectedStocks = stocksRanked.slice(0, 3);
      const selectedSp500 = sp500Ranked.slice(0, 3);

      const fiiWeights = [10, 10, 10, 10];
      const stockWeights = [10, 10, 10];
      const sp500Weights = [10, 10, 10];

      selectedFiis.forEach((asset, idx) => {
        selectedSlots.push({ asset, weight: fiiWeights[idx] || 10 });
      });
      selectedStocks.forEach((asset, idx) => {
        selectedSlots.push({ asset, weight: stockWeights[idx] || 10 });
      });
      selectedSp500.forEach((asset, idx) => {
        selectedSlots.push({ asset, weight: sp500Weights[idx] || 10 });
      });
    }

    return selectedSlots;
  };

  const applyStrategyReload = (strategyType: 'renda' | 'equilibrada' | 'crescimento') => {
    const slots = getStrategyPreview(strategyType);
    if (!slots || slots.length === 0) {
      setWalletError("Não foi possível gerar a carteira baseada nas recomendações.");
      return;
    }
    setWallet(slots);
    
    const strategyName = strategyType === 'renda' ? 'Renda & Dividendos' 
      : strategyType === 'crescimento' ? 'Crescimento Tecnológico' 
      : 'Equilíbrio Global';

    setActiveStrategy(strategyType);
    if (typeof window !== 'undefined') {
      localStorage.setItem('active_strategy', strategyType);
      pushWalletConfig();
    }

    setSuccessMsg(`AI Reload Completo! Sua carteira foi reestruturada na estratégia [${strategyName}] com base nos top ativos recomendados da IA. O total soma 100%!`);
    setTimeout(() => setSuccessMsg(null), 8500);
    setIsReloadModalOpen(false);
  };

  const applyTop10 = (type: 'stocks' | 'fii' | 'sp500') => {
    const assets = getRankedAssetsFromCategory(type);
    if (!assets || assets.length === 0) {
      setWalletError("Nenhuma recomendação recente encontrada para esta categoria.");
      return;
    }

    const newSlots = assets.map((asset) => {
      return {
        asset,
        weight: 10
      };
    });

    // We can directly set after filling up to 10 fallback if needed, which getRankedAssetsFromCategory already guarantees
    setWallet(newSlots);
    setSuccessMsg(`Top 10 ativos recomendados da categoria [${type === 'stocks' ? 'Ações BR' : type === 'fii' ? 'FIIs' : 'S&P 500'}] aplicados à sua carteira com peso igual de 10% cada!`);
    setTimeout(() => setSuccessMsg(null), 8500);
  };

  // Persistence effects
  useEffect(() => {
    localStorage.setItem('saved_interactive_wallet_full', JSON.stringify(wallet));
    const compactFormat = wallet.map(w => ({ ticker: w.asset.ticker, weight: w.weight }));
    localStorage.setItem('saved_interactive_wallet', JSON.stringify(compactFormat));
    pushWalletConfig();
  }, [wallet]);

  useEffect(() => {
    localStorage.setItem('saved_wallet_budget', String(investmentBudget));
    pushWalletConfig();
  }, [investmentBudget]);

  // Compute stats
  const totalWeight = wallet.reduce((sum, item) => sum + item.weight, 0);

  const getBRLPrice = (asset: Asset): number => {
    return asset.currency === 'USD' ? asset.price * USD_BRL_RATE : asset.price;
  };

  // Weighted Yield calculation
  const weightedAnnualYield = wallet.reduce((sum, item) => {
    return sum + (item.asset.yield * (item.weight / 100));
  }, 0);

  // Breakdown by Type
  const typeWeights = wallet.reduce((acc, item) => {
    acc[item.asset.type] = (acc[item.asset.type] || 0) + item.weight;
    return acc;
  }, {} as Record<'stocks' | 'fii' | 'sp500', number>);

  const stocksWeight = typeWeights.stocks || 0;
  const fiiWeight = typeWeights.fii || 0;
  const sp500Weight = typeWeights.sp500 || 0;

  // Geographic Weight (Brazil: stocks + fii, USA: sp500)
  const brazilWeight = stocksWeight + fiiWeight;
  const usaWeight = sp500Weight;

  // Investment values
  const yearlyDividendsSimulated = investmentBudget * weightedAnnualYield;

  const handleWeightChange = (index: number, newWeight: number) => {
    const updated = [...wallet];
    updated[index].weight = Math.max(0, Math.min(100, Math.round(newWeight)));
    setWallet(updated);
  };

  const equalizeWeights = () => {
    const updated = wallet.map(w => ({ ...w, weight: 10 }));
    setWallet(updated);
  };

  const rebalanceWeights = () => {
    if (totalWeight === 0) {
      equalizeWeights();
      return;
    }
    const ratio = 100 / totalWeight;
    let sum = 0;
    const updated = wallet.map((w, idx) => {
      let weight = Math.round(w.weight * ratio);
      if (idx === wallet.length - 1) {
        weight = 100 - sum; // fix remaining precision discrepancy
      } else {
        sum += weight;
      }
      return { ...w, weight: Math.max(1, weight) };
    });
    setWallet(updated);
  };

  const replaceAssetAtSlot = (index: number, newAsset: Asset) => {
    // Check if asset is already in the wallet in another slot
    const alreadyExists = wallet.some((w, idx) => idx !== index && w.asset.ticker === newAsset.ticker);
    if (alreadyExists) {
      setWalletError(`O ativo ${newAsset.ticker} já faz parte da sua carteira! Escolha outro para diversificar.`);
      setTimeout(() => setWalletError(null), 5000);
      setActiveReplaceIndex(null);
      return;
    }

    const updated = [...wallet];
    updated[index].asset = newAsset;
    setWallet(updated);
    setActiveReplaceIndex(null);
  };

  const getAiAdvise = async () => {
    if (totalWeight !== 100) {
      setWalletError("Por favor, rebalanceie o peso dos ativos de modo que a soma total seja exatamente 100%!");
      return;
    }

    setLoadingAi(true);
    setWalletError(null);
    try {
      const serializableWallet = wallet.map(w => ({
        ticker: w.asset.ticker,
        name: w.asset.name,
        type: w.asset.type,
        weight: w.weight,
        sector: w.asset.sector
      }));

      const isLocalhost = typeof window !== 'undefined' && window.location.hostname.includes('localhost');
      const apiHost = isLocalhost ? '' : `https://${window.location.host}`;
      
      const walletStr = JSON.stringify(serializableWallet);
      const params = new URLSearchParams({
        wallet: walletStr
      });
      const apiUrl = `${apiHost}/api/wallet-insight?${params.toString()}`;

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Wallet-Data': walletStr
        },
        body: JSON.stringify({ wallet: serializableWallet })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to generate dynamic assessment.");
      }

      const data = await res.json();
      setAiReport(data.result);
      localStorage.setItem('saved_wallet_ai_report', data.result);
    } catch (e: any) {
      console.error(e);
      setWalletError("Erro ao obter conselho do Advisor de IA: " + e.message);
    } finally {
      setLoadingAi(false);
    }
  };

  const clearReport = () => {
    setAiReport(null);
    localStorage.removeItem('saved_wallet_ai_report');
  };

  // Customized dynamic SVG Pie Segment calculations for visual rendering
  const getPiePath = (startPercent: number, endPercent: number, radius: number): string => {
    const startAngle = (startPercent / 100) * 360 - 90;
    const endAngle = (endPercent / 100) * 360 - 90;
    
    // Degrees to radians conversion helper
    const rad = (deg: number) => (deg * Math.PI) / 180;
    
    const x1 = 50 + radius * Math.cos(rad(startAngle));
    const y1 = 50 + radius * Math.sin(rad(startAngle));
    const x2 = 50 + radius * Math.cos(rad(endAngle));
    const y2 = 50 + radius * Math.sin(rad(endAngle));
    
    const largeArcFlag = endPercent - startPercent > 50 ? 1 : 0;
    
    // Direct path descriptor for SVG arc
    return `M 50 50 L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Strategy Selection Modal for AI Reload */}
      {isReloadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl p-6 sm:p-8 bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0 text-amber-400 border border-amber-500/20">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    AI Reload da Carteira
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Selecione a melhor estratégia para mesclar as 30 ações de melhor ranking recomendadas pela IA
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setIsReloadModalOpen(false)}
                className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Strategy Selectors */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                {
                  id: 'equilibrada' as const,
                  title: 'Equilíbrio Global',
                  desc: '40% FIIs, 30% Ações BR, 30% S&P 500',
                  color: 'border-blue-500 bg-blue-500/5 text-blue-300',
                  badge: 'Moderado',
                  distribution: '4 FIIs + 3 Ações + 3 S&P 500'
                },
                {
                  id: 'renda' as const,
                  title: 'Renda & Dividendos',
                  desc: '60% FIIs, 30% Ações BR, 10% S&P 500',
                  color: 'border-emerald-500 bg-emerald-500/5 text-emerald-300',
                  badge: 'Renda Passiva',
                  distribution: '5 FIIs + 3 Ações + 2 S&P 500'
                },
                {
                  id: 'crescimento' as const,
                  title: 'Crescimento Global',
                  desc: '60% S&P 500, 30% Ações BR, 10% FIIs',
                  color: 'border-amber-500 bg-amber-500/5 text-amber-300',
                  badge: 'Alto Upside',
                  distribution: '5 S&P 500 + 3 Ações + 2 FIIs'
                }
              ].map((strat) => (
                <button
                  key={strat.id}
                  type="button"
                  onClick={() => setSelectedStrategy(strat.id)}
                  className={`flex flex-col text-left p-4 rounded-2xl border-2 transition cursor-pointer relative ${
                    selectedStrategy === strat.id 
                    ? `${strat.color} ring-4 ring-offset-2 ring-offset-slate-900 border-transparent` 
                    : 'border-slate-800 bg-slate-800/40 hover:border-slate-700 hover:bg-slate-800/80'
                  }`}
                >
                  <div className="flex items-center justify-between w-full h-fit gap-1 mb-1">
                    <span className="text-xs font-black text-white">{strat.title}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-slate-300 font-bold uppercase tracking-wider">{strat.badge}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 mb-2 leading-relaxed">{strat.desc}</span>
                  <span className="text-[9px] text-slate-500 font-mono font-medium mt-auto">{strat.distribution}</span>
                </button>
              ))}
            </div>

            {/* Asset Preview Section */}
            <div className="space-y-3 bg-slate-950/40 p-5 rounded-2xl border border-white/5">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center justify-between">
                <span>Ativos Selecionados (Top 10 Mesclados)</span>
                <span className="text-[10px] text-slate-500 lowercase">Ordenados conforme ranking de recomendação</span>
              </h4>
              
              <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 scrollbar-none">
                {getStrategyPreview(selectedStrategy).map((slot, index) => (
                  <div 
                    key={slot.asset.ticker + index}
                    className="flex items-center justify-between p-2.5 bg-slate-900 border border-white/5 rounded-xl transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-500 font-mono">
                        #{index + 1}
                      </span>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-white font-mono">{slot.asset.ticker}</span>
                          <span className={`text-[9.5px] px-1.5 py-0.2 rounded font-bold uppercase ${
                            slot.asset.type === 'fii' 
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                              : slot.asset.type === 'stocks'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
                            {slot.asset.type === 'fii' ? 'FII' : slot.asset.type === 'stocks' ? 'Ação BR' : 'S&P 500'}
                          </span>
                        </div>
                        <span className="text-[10.5px] text-slate-400 truncate max-w-[280px]">{slot.asset.name}</span>
                      </div>
                    </div>

                    <div className="text-right flex items-center gap-3 shrink-0">
                      <div className="flex flex-col items-end">
                        <span className="text-xs font-black text-white">{slot.weight}%</span>
                        <span className="text-[9px] text-slate-500 font-mono">alocação</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 mt-2">
              <span className="text-[10px] text-slate-400 max-w-[340px] leading-relaxed">
                * Os pesos foram estrategicamente alocados com pesos de até 15% nos ativos de topo e 5% nos complementares de forma a fechar <strong>100%</strong> de alocação exata.
              </span>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsReloadModalOpen(false)}
                  className="px-4 py-2 hover:bg-white/5 border border-white/10 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => applyStrategyReload(selectedStrategy)}
                  className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black rounded-xl text-xs font-black uppercase tracking-wider transition duration-200 shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  ✓ Executar AI Reload
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Premium Non-Blocking Confirmation Dialog */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md p-6 bg-slate-900 border border-slate-700/85 rounded-3xl shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0 text-amber-400 border border-amber-500/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-white leading-tight">
                  {confirmModal.title}
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {confirmModal.message}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black rounded-xl text-xs font-black uppercase tracking-wider transition duration-200 shadow-md shadow-amber-500/20 cursor-pointer"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Success Toast / Banner */}
      {successMsg && (
        <div className="bg-emerald-950/85 text-emerald-200 border border-emerald-500/50 rounded-2xl p-4 text-sm font-medium flex items-center gap-3 backdrop-blur-md shadow-lg animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <p className="flex-1 font-medium">{successMsg}</p>
          <button 
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-xs hover:text-white text-emerald-400 font-bold underline ml-2 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Visual Alert Banner for Wallet Errors */}
      {walletError && (
        <div className="bg-red-950/80 text-red-200 border border-red-500/50 rounded-2xl p-4 text-sm font-medium flex items-center gap-3 backdrop-blur-md shadow-lg animate-in fade-in duration-300">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p>{walletError}</p>
        </div>
      )}

      {/* Top Section and Welcome Descriptor */}
      <div className="bg-black/30 border border-white/10 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
        <div className="space-y-2 text-center md:text-left">
          <h2 className="text-3xl font-extrabold text-white tracking-tight flex items-center justify-center md:justify-start gap-3">
            <Wallet className="w-8 h-8 text-indigo-400" />
            Minha Carteira (Wallet)
          </h2>
          <p className="text-slate-300 max-w-xl text-sm leading-relaxed">
            Monte e otimize uma carteira global contendo exatamente <strong className="font-bold text-white">10 ativos estratégicos</strong>. 
            Misture ações brasileiras de alto dividendos, fundos imobiliários rentáveis e líderes do índice S&P 500 americano selecionados de nossa biblioteca de recomendados.
          </p>
        </div>

        {/* Big visual score / health indicator */}
        <div className="flex flex-col items-center justify-center bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-center min-w-[160px] shadow-inner">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Status de Peso</span>
          {totalWeight === 100 ? (
            <div className="flex flex-col items-center text-emerald-400">
              <CheckCircle className="w-7 h-7 mb-1" />
              <span className="text-xl font-bold">100% Ok</span>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <span className={`text-2xl font-black ${totalWeight > 100 ? 'text-rose-400' : 'text-amber-400'}`}>
                {totalWeight}%
              </span>
              <span className="text-xs text-slate-300 mt-1">Deve somar 100%</span>
            </div>
          )}
        </div>
      </div>

      {/* Quick Option to Rebuild / Overwrite Portfolio with Top 10 recommendations */}
       {(hasStocksAnalysis || hasFiiAnalysis || hasSp500Analysis) ? (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 backdrop-blur-sm relative overflow-hidden animate-in fade-in duration-300">
          <div className="absolute top-0 right-0 w-[200px] h-[150px] bg-amber-500/5 blur-[50px] rounded-full -z-10"></div>
          
          <div className="space-y-1.5 text-center md:text-left">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] uppercase font-black text-amber-300 bg-amber-500/20 border border-amber-500/30">
              <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" /> Recomendações de IA Disponíveis
            </span>
            <h3 className="text-lg font-bold text-white">
              AI Reload da Carteira
            </h3>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Deseja redefinir sua carteira de investimentos? Mescle automaticamente as <strong className="text-white font-bold">30 recomendações rankeadas pela IA</strong> (10 Ações, 10 FIIs e 10 S&P) selecionando a estratégia ideal com alocação otimizada.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto shrink-0 animate-pulse-slow">
            <button
              type="button"
              onClick={() => {
                setIsReloadModalOpen(true);
              }}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl transition duration-300 active:scale-95 shadow-lg shadow-amber-500/20 cursor-pointer border border-amber-300/30 font-sans"
            >
              📥 AI Reload da carteira
            </button>

            {/* Selector dropdown/list if they want to choose a specific category */}
            <div className="flex gap-1.5 flex-wrap justify-center">
              {hasStocksAnalysis && (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmModal({
                      title: "Confirmar Top 10 Ações BR",
                      message: "Deseja substituir sua carteira atual pelas 10 melhores Ações Brasileiras recomendadas pelo relatório de inteligência artificial?",
                      onConfirm: () => applyTop10('stocks')
                    });
                  }}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 hover:border-amber-500/30 border border-white/10 rounded-lg text-[10px] font-bold text-slate-300 hover:text-white transition cursor-pointer"
                  title="Aplicar Ações BR"
                >
                  Ações BR
                </button>
              )}
              {hasFiiAnalysis && (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmModal({
                      title: "Confirmar Top 10 FIIs BR",
                      message: "Deseja substituir sua carteira atual pelos 10 melhores Fundos Imobiliários recomendados pelo relatório de inteligência artificial?",
                      onConfirm: () => applyTop10('fii')
                    });
                  }}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 hover:border-amber-500/30 border border-white/10 rounded-lg text-[10px] font-bold text-slate-300 hover:text-white transition cursor-pointer"
                  title="Aplicar FIIs BR"
                >
                  FIIs BR
                </button>
              )}
              {hasSp500Analysis && (
                <button
                  type="button"
                  onClick={() => {
                    setConfirmModal({
                      title: "Confirmar Top 10 S&P 500",
                      message: "Deseja substituir sua carteira atual pelos 10 melhores ativos americanos do S&P 500 recomendados pelo relatório de inteligência artificial?",
                      onConfirm: () => applyTop10('sp500')
                    });
                  }}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 hover:border-amber-500/30 border border-white/10 rounded-lg text-[10px] font-bold text-slate-300 hover:text-white transition cursor-pointer"
                  title="Aplicar S&P 500"
                >
                  S&P 500
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-5 shadow-inner flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left animate-in fade-in duration-300">
          <div className="flex items-center gap-3 justify-center sm:justify-start">
            <Sparkles className="w-5 h-5 text-indigo-400 shrink-0 animate-pulse" />
            <div className="text-xs">
              <p className="font-bold text-slate-200">Dica de Praticidade</p>
              <p className="text-slate-400 leading-relaxed">Você pode preencher esta carteira inteira clicando em um único botão! Para isso, vá até a aba <strong className="text-white font-semibold">"Análise Geral"</strong> e faça o upload e análise de sua planilha financeira de ações, FIIs ou ativos americanos.</p>
            </div>
          </div>
        </div>
      )}

      {/* Grid: Left Column (Otimização & Slots) & Right Column (Métricas e Visualização) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: Asset selection & weights slider */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-black/20 border border-white/10 rounded-3xl p-6 shadow-md space-y-6">
            
            {/* Header Control row */}
            <div className="border-b border-white/10 pb-4 space-y-3">
              {/* Active Strategy Indicator */}
              {(() => {
                const stratInfo = activeStrategy === 'renda' 
                  ? { title: 'Renda & Dividendos', badge: 'Renda Passiva', color: 'border-amber-500/20 bg-amber-500/10 text-amber-400' }
                  : activeStrategy === 'crescimento'
                    ? { title: 'Crescimento Global', badge: 'Alto Upside', color: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' }
                    : { title: 'Equilíbrio Global', badge: 'Moderado', color: 'border-blue-500/20 bg-blue-500/10 text-blue-400' };
                
                return (
                  <div className="flex items-center gap-2 flex-wrap text-left">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Estratégia Selecionada:</span>
                    <div className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-black border ${stratInfo.color}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                      <span>{stratInfo.title}</span>
                      <span className="opacity-45">|</span>
                      <span>{stratInfo.badge}</span>
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-center justify-between flex-wrap gap-4 pt-1">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-indigo-400" />
                  Alocação e Balanceamento
                </h3>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={equalizeWeights} 
                    className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs font-semibold hover:bg-white/10 text-slate-300 transition"
                  >
                    Distribuir Igual (10%)
                  </button>
                  <button 
                    onClick={rebalanceWeights} 
                    className="px-3 py-1.5 bg-indigo-500/10 border border-indigo-400/20 text-indigo-300 rounded-xl text-xs font-bold hover:bg-indigo-500/25 transition flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Rebalancear 100%
                  </button>
                </div>
              </div>
            </div>

            {/* List of 10 slots */}
            <div className="divide-y divide-white/5 space-y-4">
              {wallet.map((slot, idx) => (
                <div key={`${slot.asset.ticker}-${idx}`} className="pt-4 first:pt-0 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    
                    {/* Left: Ticker details */}
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-500 w-5 text-center bg-white/5 rounded-full h-5 flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white tracking-wider text-base">
                            {slot.asset.ticker}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                            slot.asset.type === 'stocks' 
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' 
                              : slot.asset.type === 'fii'
                                ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                                : 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                          }`}>
                            {slot.asset.type === 'stocks' ? 'Ações BR' : slot.asset.type === 'fii' ? 'FII' : 'S&P 500'}
                          </span>
                        </div>
                        <p className="text-slate-400 text-xs font-medium max-w-[210px] truncate">{slot.asset.name}</p>
                      </div>
                    </div>

                    {/* Middle info and selector trigger */}
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs text-slate-300 font-bold">
                          {slot.asset.currency === 'USD' 
                            ? `US$ ${slot.asset.price.toFixed(2)}` 
                            : `R$ ${slot.asset.price.toFixed(2)}`}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Setor: {slot.asset.sector.split(' / ')[0]}
                        </p>
                      </div>

                      {/* Replace Asset / Trigger replacement dropdown modal */}
                      <button
                        onClick={() => setActiveReplaceIndex(activeReplaceIndex === idx ? null : idx)}
                        className="p-1 px-2.5 bg-white/5 border border-white/10 rounded-lg text-xs font-semibold hover:bg-indigo-500/20 hover:text-indigo-200 hover:border-indigo-500/30 text-slate-300 transition"
                      >
                        Substituir
                      </button>
                    </div>

                  </div>

                  {/* Range Slider for weights */}
                  <div className="flex items-center gap-4 pl-8 group">
                    <input 
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={slot.weight}
                      onChange={e => handleWeightChange(idx, Number(e.target.value))}
                      className="flex-1 accent-indigo-400 h-1.5 bg-black/40 rounded-lg cursor-pointer"
                    />
                    <div className="w-14 shrink-0 flex items-center justify-end bg-black/30 border border-white/10 rounded-md py-0.5 px-2 text-right">
                      <span className="text-sm font-semibold text-white tracking-tight">{slot.weight}</span>
                      <span className="text-xs text-indigo-300 ml-0.5 font-bold">%</span>
                    </div>
                  </div>

                  {/* Dropdown Replacement Menu - Shown inline below the slot when active */}
                  {activeReplaceIndex === idx && (
                    <div className="pl-8 pt-2 pb-4 bg-black/20 rounded-xl p-4 border border-white/5 animate-in slide-in-from-top-2 duration-200">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-300">Escolha um dos {ALL_BEST_30_ASSETS.length} melhores ativos:</span>
                        <button 
                          onClick={() => setActiveReplaceIndex(null)}
                          className="text-xs hover:text-white text-slate-400 font-medium"
                        >
                          Fechar
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 pr-1">
                        {ALL_BEST_30_ASSETS.map((asset) => {
                          const isInWallet = wallet.some((w) => w.asset.ticker === asset.ticker);
                          return (
                            <button
                              key={asset.ticker}
                              disabled={isInWallet}
                              onClick={() => replaceAssetAtSlot(idx, asset)}
                              className={`p-2.5 rounded-lg border text-left transition text-xs relative ${
                                isInWallet 
                                  ? 'bg-white/5 border-white/5 text-slate-500 cursor-not-allowed opacity-55' 
                                  : 'bg-black/40 border-white/10 hover:border-indigo-400/50 hover:bg-white/5 text-white'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold font-mono tracking-wider">{asset.ticker}</span>
                                <span className="text-[9px] text-slate-400 uppercase tracking-widest">{asset.type === 'stocks' ? 'Ação' : asset.type === 'fii' ? 'FII' : 'S&P 500'}</span>
                              </div>
                              <p className="truncate text-slate-400 pr-4">{asset.name}</p>
                              {isInWallet && (
                                <span className="absolute bottom-1 right-2 text-[8px] font-bold text-indigo-400 uppercase">Na Carteira</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                </div>
              ))}
            </div>

          </div>
        </div>

        {/* RIGHT COLUMN: Performance simulators & Allocation Graphic breakdown */}
        <div className="space-y-6">

          {/* Custom Graphical Charts Panel */}
          <div className="bg-black/30 border border-white/10 rounded-3xl p-6 shadow-lg space-y-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/10 pb-3">
              <Briefcase className="w-5 h-5 text-indigo-400" />
              Distribuição Patrimonial
            </h3>

            {/* Geographic Diversification Indicator */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-blue-400" /> Brasil ({brazilWeight}%)
                </span>
                <span className="text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-indigo-400" /> EUA ({usaWeight}%)
                </span>
              </div>
              
              <div className="w-full bg-black/40 h-3 rounded-full overflow-hidden flex border border-white/10">
                <div className="bg-gradient-to-r from-blue-500 to-cyan-500 h-full" style={{ width: `${brazilWeight}%` }}></div>
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 h-full" style={{ width: `${usaWeight}%` }}></div>
              </div>
            </div>

            {/* Custom Pie Chart constructed using SVG circles - extremely lightweight and highly compatible */}
            <div className="flex flex-col items-center justify-center pt-2">
              <div className="relative w-36 h-36">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  {/* Default Background */}
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#1e293b" strokeWidth="8" />
                  
                  {/* Category Arcs */}
                  {/* Arc Ações Stocks (Green) */}
                  {stocksWeight > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="10"
                      strokeDasharray={`${(stocksWeight / 100) * 251.2} 251.2`}
                      strokeDashoffset="0"
                      strokeLinecap="butt"
                      className="transition-all duration-500"
                    />
                  )}

                  {/* Arc FIIs (Amber) */}
                  {fiiWeight > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="10"
                      strokeDasharray={`${(fiiWeight / 100) * 251.2} 251.2`}
                      strokeDashoffset={-((stocksWeight / 100) * 251.2)}
                      strokeLinecap="butt"
                      className="transition-all duration-500"
                    />
                  )}

                  {/* Arc S&P 500 (Blue/Lightblue) */}
                  {sp500Weight > 0 && (
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="10"
                      strokeDasharray={`${(sp500Weight / 100) * 251.2} 251.2`}
                      strokeDashoffset={-(((stocksWeight + fiiWeight) / 100) * 251.2)}
                      strokeLinecap="butt"
                      className="transition-all duration-500"
                    />
                  )}
                </svg>

                {/* Inner label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-xs text-slate-400 font-bold tracking-tight">Ativos</span>
                  <span className="text-xl font-extrabold text-white">10 Slots</span>
                </div>
              </div>

              {/* Legends list */}
              <div className="w-full grid grid-cols-3 gap-2 mt-4 text-center">
                <div className="bg-black/20 p-2 rounded-xl border border-white/5">
                  <span className="block w-2.5 h-2.5 rounded-full bg-emerald-500 mx-auto mb-1"></span>
                  <span className="text-[10px] text-slate-400 block font-bold">Ações BR</span>
                  <span className="text-xs font-bold text-white">{stocksWeight}%</span>
                </div>
                <div className="bg-black/20 p-2 rounded-xl border border-white/5">
                  <span className="block w-2.5 h-2.5 rounded-full bg-amber-500 mx-auto mb-1"></span>
                  <span className="text-[10px] text-slate-400 block font-bold">FIIs BR</span>
                  <span className="text-xs font-bold text-white">{fiiWeight}%</span>
                </div>
                <div className="bg-black/20 p-2 rounded-xl border border-white/5">
                  <span className="block w-2.5 h-2.5 rounded-full bg-blue-500 mx-auto mb-1"></span>
                  <span className="text-[10px] text-slate-400 block font-bold">S&P 500</span>
                  <span className="text-xs font-bold text-white">{sp500Weight}%</span>
                </div>
              </div>

            </div>

          </div>

        </div>

      </div>

      {/* AI INVESTMENT ADVICE PORTAL SECTION */}
      <div className="border-t border-white/10 pt-8 mt-10">
        <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900/60 border border-indigo-500/20 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl relative overflow-hidden">
          
          {/* Subtle glowing ambient light behind the AI Advice banner */}
          <div className="absolute top-0 right-0 w-[400px] h-[300px] bg-indigo-500/5 blur-[120px] rounded-full -z-10"></div>
          
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center md:text-left">
              <h3 className="text-xl font-extrabold text-white flex items-center justify-center md:justify-start gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
                Parecer de Diversificação e Risco por IA
              </h3>
              <p className="text-xs text-slate-300 max-w-xl">
                Envie suas posições e alocações personalizadas para a inteligência artificial do Gemini analisar o risco setorial, diversificação global e balanço de rendimentos.
              </p>
            </div>

            <div className="flex gap-3">
              {aiReport && (
                <button 
                  onClick={clearReport}
                  className="px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition"
                >
                  Limpar Relatório
                </button>
              )}
              <button
                onClick={getAiAdvise}
                disabled={loadingAi}
                className="px-6 py-3 bg-indigo-500 text-white rounded-xl text-xs font-black shadow-lg hover:bg-indigo-600 border border-indigo-400/30 transition flex items-center gap-2"
              >
                {loadingAi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {loadingAi ? 'Analisando Carteira...' : 'Obter Relatório do AI Advisor'}
              </button>
            </div>
          </div>

          {/* Markdown advice display */}
          {aiReport && (
            <div className="bg-black/40 border border-white/10 rounded-2xl p-6 md:p-8 text-slate-200 text-sm leading-relaxed animate-in fade-in duration-300">
              <div className="markdown-body">
                <Markdown>{aiReport}</Markdown>
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}
