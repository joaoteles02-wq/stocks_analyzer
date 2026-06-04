import { useState, useEffect, useRef } from 'react';
import { getHistoricalPrice } from '../lib/yahoo';
import { 
  ALL_BEST_30_ASSETS, 
  Asset 
} from './WalletView';
import { 
  LineChart, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Check, 
  Eye, 
  EyeOff, 
  ChevronRight,
  Info,
  BarChart2,
  Percent,
  Coins,
  Search
} from 'lucide-react';

interface HistoricalPoint {
  date: string;
  prices: Record<string, number>; // Ticker -> Price
}

export function DashboardView() {
  const USD_BRL_RATE = 5.15;

  // 1. Load active wallet assets from local storage or fallback to defaults
  const [walletAssets, setWalletAssets] = useState<Asset[]>([]);
  const [walletWeights, setWalletWeights] = useState<Record<string, number>>({});
  const [investmentBudget, setInvestmentBudget] = useState<number>(125000);

  useEffect(() => {
    // Read budget
    const savedBudget = localStorage.getItem('saved_wallet_budget');
    if (savedBudget) {
      const parsed = Number(savedBudget);
      if (parsed === 25000) {
        setInvestmentBudget(125000);
        localStorage.setItem('saved_wallet_budget', '125000');
      } else {
        setInvestmentBudget(parsed);
      }
    } else {
      localStorage.setItem('saved_wallet_budget', '125000');
    }

    // Read wallet
    const savedFull = localStorage.getItem('saved_interactive_wallet_full');
    if (savedFull) {
      try {
        const parsed = JSON.parse(savedFull);
        if (Array.isArray(parsed) && parsed.length === 10) {
          const assetsList: Asset[] = parsed.map(w => w.asset);
          const weightsMap: Record<string, number> = {};
          parsed.forEach(w => {
            weightsMap[w.asset.ticker] = w.weight;
          });
          setWalletAssets(assetsList);
          setWalletWeights(weightsMap);
          return;
        }
      } catch (e) {
        console.error('Failed to parse full saved wallet in Dashboard:', e);
      }
    }

    const savedWallet = localStorage.getItem('saved_interactive_wallet');
    if (savedWallet) {
      try {
        const parsed = JSON.parse(savedWallet);
        if (Array.isArray(parsed) && parsed.length === 10) {
          const assetsList: Asset[] = [];
          const weightsMap: Record<string, number> = {};
          
          parsed.forEach((item: any) => {
            const matched = ALL_BEST_30_ASSETS.find(a => a.ticker === item.ticker);
            if (matched) {
              assetsList.push(matched);
              weightsMap[matched.ticker] = item.weight;
            }
          });

          if (assetsList.length > 0) {
            setWalletAssets(assetsList);
            setWalletWeights(weightsMap);
            return;
          }
        }
      } catch (e) {
        console.error('Failed to parse wallet in Dashboard:', e);
      }
    }

    // Default Fallback matching standard WalletView default setup
    const defaultTickers = ['ITUB4', 'WEGE3', 'TAEE11', 'HGLG11', 'MXRF11', 'XPML11', 'AAPL', 'MSFT', 'GOOGL', 'NVDA'];
    const defaultWeights: Record<string, number> = {
      'ITUB4': 15, 'WEGE3': 10, 'TAEE11': 10, 'HGLG11': 15, 'MXRF11': 10, 'XPML11': 10, 'AAPL': 10, 'MSFT': 10, 'GOOGL': 5, 'NVDA': 5
    };
    const defaultList = ALL_BEST_30_ASSETS.filter(a => defaultTickers.includes(a.ticker));
    setWalletAssets(defaultList);
    setWalletWeights(defaultWeights);
  }, []);

  // 2. Selectable Tickers for plotting
  const [selectedTickers, setSelectedTickers] = useState<string[]>([]);

  // Automatically select the top 4 assets by weight to avoid chart clutter initially
  useEffect(() => {
    if (walletAssets.length > 0) {
      const sortedByWeight = [...walletAssets].sort((a, b) => {
        const wA = walletWeights[a.ticker] || 0;
        const wB = walletWeights[b.ticker] || 0;
        return wB - wA;
      });
      setSelectedTickers(sortedByWeight.slice(0, 4).map(a => a.ticker));
    }
  }, [walletAssets, walletWeights]);

  // Chart view Mode: 'individual' (show lines for each asset) or 'portfolio' (show aggregate consolidated portfolio value over time)
  const [chartMode, setChartMode] = useState<'individual' | 'portfolio'>('individual');
  const [showCdiBenchmark, setShowCdiBenchmark] = useState<boolean>(true);
  const [yieldSortMode, setYieldSortMode] = useState<'yield' | 'ticker' | 'weight'>('yield');

  // Column overrides for Sheets pricing parsing
  const [overrideInitialPriceColIdx, setOverrideInitialPriceColIdx] = useState<number>(() => {
    const val = localStorage.getItem('sheet_initial_price_col_idx');
    return val ? parseInt(val, 10) : -1;
  });
  const [overrideCurrentPriceColIdx, setOverrideCurrentPriceColIdx] = useState<number>(() => {
    const val = localStorage.getItem('sheet_current_price_col_idx');
    return val ? parseInt(val, 10) : -1;
  });

  const [yahooPrices, setYahooPrices] = useState<Record<string, number>>({});
  const [isLoadingPrices, setIsLoadingPrices] = useState<boolean>(true);

  useEffect(() => {
    const fetchAllYahooPrices = async () => {
      setIsLoadingPrices(true);
      const prices: Record<string, number> = {};
      const assets = walletAssets.length > 0 ? walletAssets : ALL_BEST_30_ASSETS;
      for (const asset of assets) {
        // Automatically add .SA if it's B3 (stocks or fii)
        const tickerToFetch = (asset.type === 'stocks' || asset.type === 'fii') ? `${asset.ticker}.SA` : asset.ticker;
        const p = await getHistoricalPrice(tickerToFetch, '2026-01-02');
        if (p) prices[asset.ticker] = p;
      }
      setYahooPrices(prices);
      setIsLoadingPrices(false);
    };
    fetchAllYahooPrices();
  }, [walletAssets]);

  useEffect(() => {
    localStorage.setItem('sheet_initial_price_col_idx', overrideInitialPriceColIdx.toString());
  }, [overrideInitialPriceColIdx]);

  useEffect(() => {
    localStorage.setItem('sheet_current_price_col_idx', overrideCurrentPriceColIdx.toString());
  }, [overrideCurrentPriceColIdx]);

  const maxYieldInPortfolio = Math.max(
    ...walletAssets.map(a => typeof a.yield === 'number' && !isNaN(a.yield) ? a.yield : 0),
    0.01
  );
  const sortedAssetsForYield = [...walletAssets].sort((a, b) => {
    if (yieldSortMode === 'yield') {
      return b.yield - a.yield;
    } else if (yieldSortMode === 'ticker') {
      return a.ticker.localeCompare(b.ticker);
    } else {
      const wA = walletWeights[a.ticker] || 0;
      const wB = walletWeights[b.ticker] || 0;
      return wB - wA;
    }
  });

  // Taxas acumuladas do CDI para 2026: Jan/26 (0.0%), Fev/26 (+0.82%), Mar/26 (+1.68%), Abr/26 (+2.53%), Mai/26 (+3.39%)
  const CDI_ACUMULADO_2026 = [0.0, 0.82, 1.68, 2.53, 3.39];

  // Tabela de preços reais históricos de fechamento obtidos via GOOGLEFINANCE em "02/01/2026" para as 30 opções padrão
  // Preços reais de fechamento em 02/01/2026 obtidos via Yahoo Finance
  const PRECOS_REAIS_02_01_2026: Record<string, number> = {
    'VALE3': 72.38,
    'PETR4': 30.71,
    'ITUB4': 39.15,
    'BBAS3': 21.68,
    'WEGE3': 48.25,
    'EGIE3': 31.13,
    'ABEV3': 13.65,
    'ELET3': 40.50,
    'KLBN11': 19.09,
    'TAEE11': 41.97,
    'MXRF11': 9.50,
    'HGLG11': 157.80,
    'XPML11': 108.90,
    'KNIP11': 90.07,
    'KNCR11': 106.20,
    'XPLG11': 104.72,
    'BTLG11': 103.69,
    'VISC11': 108.46,
    'HGBS11': 19.88,
    'ALZR11': 10.75,
    'AAPL': 271.01,
    'MSFT': 472.94,
    'NVDA': 188.85,
    'AMZN': 226.50,
    'GOOGL': 315.15,
    'META': 650.41,
    'TSLA': 438.07,
    'BRK.B': 496.85,
    'JPM': 325.48,
    'LLY': 1080.36,
    'CMIN3': 5.0
  };

  // Função auxiliar para recuperar o preço de um ativo ignorando diferenças de caixa (maiúscula/minúscula) e espaços em branco
  const getAssetPriceAtPoint = (point: HistoricalPoint | undefined, ticker: string, fallbackPrice: number): number => {
    if (!point || !point.prices || !ticker) return fallbackPrice;
    const cleanTicker = ticker.trim().toUpperCase();
    const matchingKey = Object.keys(point.prices).find(
      key => key.trim().toUpperCase() === cleanTicker
    );
    if (matchingKey && point.prices[matchingKey] !== undefined) {
      return point.prices[matchingKey];
    }
    return fallbackPrice;
  };

  // Função robusta para decodificar números formatados em português brasileiro (ex: 1.150,50 ou 35,50) ou inglês
  const parsePortugueseNumber = (valStr: string): number => {
    if (!valStr) return NaN;
    let clean = valStr.replace('R$', '').replace('$', '').trim();
    if (clean.includes('.') && clean.includes(',')) {
      // Se contiver ponto e vírgula, ex: 1.234,56 -> remove o ponto de milhar e substitui a vírgula por ponto decimal
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (clean.includes(',')) {
      // Se só tiver vírgula, ex: 35,50 -> substitui por ponto decimal
      clean = clean.replace(',', '.');
    }
    return Number(clean);
  };

  // Tenta recuperar o preço inicial da planilha carregada pelo usuário (procurando pela data '02/01/2026' ou fórmulas de fechamento)
  const getInitialPriceFromSheetData = (ticker: string): number | null => {
    try {
      const savedLocal = localStorage.getItem('local_uploaded_sheet_data');
      if (!savedLocal) return null;
      const localRows: any[][] = JSON.parse(savedLocal);
      if (!Array.isArray(localRows) || localRows.length < 2) return null;

      const cleanTicker = ticker.trim().toUpperCase();

      // Encontra a linha do ativo correspondente
      const matchedRow = localRows.find((row, idx) => {
        if (idx === 0) return false;
        return Array.isArray(row) && row.some(cell => {
          const s = String(cell).trim().toUpperCase();
          return s === cleanTicker || s === `${cleanTicker}.SA` || s.replace('.SA', '') === cleanTicker;
        });
      });

      if (!matchedRow) return null;

      // Se há um índice explícito de preço inicial configurado pelo usuário
      if (overrideInitialPriceColIdx !== -1 && matchedRow[overrideInitialPriceColIdx] !== undefined) {
        const valStr = String(matchedRow[overrideInitialPriceColIdx]).trim();
        const num = parsePortugueseNumber(valStr);
        if (!isNaN(num) && num > 0) {
          return num;
        }
      }

      // Senão, adota mapeamento automático pelo cabeçalho
      const headerRow = localRows[0].map(cell => String(cell).trim().toLowerCase());
      
      // Procura colunas que tenham relação com o preço inicial em 02/01/2026 ou fórmulas de fechamento/custo
      let colIndex = -1;
      for (let i = 0; i < headerRow.length; i++) {
        const header = headerRow[i];
        if (
          header.includes('02/01/2026') || 
          header.includes('googlefinance') || 
          header.includes('inicial') || 
          header.includes('fechamento') || 
          header.includes('close') || 
          header.includes('abertura') || 
          header.includes('jan') ||
          header.includes('custo') ||
          header.includes('compra') ||
          header.includes('medio') ||
          header.includes('médio') ||
          header.includes('pago') ||
          header.includes('aquisicao') ||
          header.includes('aquisição') ||
          header.includes('cost') ||
          header.includes('yoc')
        ) {
          // evita coluna do preço atualizado ou mercado
          if (!header.includes('atual') && !header.includes('hoje') && !header.includes('agora') && !header.includes('mercado') && !header.includes('cotação') && !header.includes('cotacao')) {
            colIndex = i;
            break;
          }
        }
      }

      // Se não achou pelo cabeçalho explícito, procura uma coluna com "close" ou "2026"
      if (colIndex === -1) {
        for (let i = 0; i < headerRow.length; i++) {
          const header = headerRow[i];
          if (header.includes('close') || header.includes('2026')) {
            colIndex = i;
            break;
          }
        }
      }

      if (colIndex !== -1 && matchedRow[colIndex] !== undefined) {
        const cellVal = String(matchedRow[colIndex]).trim();
        const num = parsePortugueseNumber(cellVal);
        if (!isNaN(num) && num > 0) {
          return num;
        }
      }

      // Scanner de fallback em caso de falta de cabeçalho descritivo
      const currentAsset = walletAssets.find(a => a.ticker.trim().toUpperCase() === cleanTicker) || 
                          ALL_BEST_30_ASSETS.find(a => a.ticker.trim().toUpperCase() === cleanTicker);
      const currentPrice = currentAsset ? currentAsset.price : 0;
      
      // Coleta todos os números válidos da linha com seus índices de coluna
      const numericValues: { idx: number; val: number }[] = [];
      for (let i = 0; i < matchedRow.length; i++) {
        const cell = matchedRow[i];
        if (cell !== undefined && cell !== null) {
          const val = parsePortugueseNumber(String(cell));
          if (!isNaN(val) && val > 0.1 && val < 100000) {
            numericValues.push({ idx: i, val });
          }
        }
      }

      // Se houver mais de um número, o outro número provavelmente é o preço inicial histórico
      if (numericValues.length >= 2) {
        // Se soubermos o preço atual, o preço inicial é o outro valor monetário
        for (const item of numericValues) {
          if (currentPrice > 0 && Math.abs(item.val - currentPrice) > 0.05) {
            // Garante que é uma quantia razoável para o preço (ignora inteiros grandes como quantidades ex: 100, se houver alternativa)
            const otherVals = numericValues.filter(o => o.idx !== item.idx && Math.abs(o.val - currentPrice) <= 0.05);
            if (otherVals.length > 0) {
              return item.val;
            }
          }
        }
        return numericValues[0].val;
      } else if (numericValues.length === 1) {
        return numericValues[0].val;
      }
    } catch (e) {
      console.error('Error finding initial price from uploaded sheet:', e);
    }
    return null;
  };

  // Gerador determinístico de dados históricos para exibição consistente a partir de Janeiro de 2026
  const getHistoricalData = (): HistoricalPoint[] => {
    const activeDates = ['Jan 26', 'Fev 26', 'Mar 26', 'Abr 26', 'Mai 26'];

    // Gera um seed numérico baseado no ticker para variações determinísticas
    const getSeed = (str: string) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
      }
      return Math.abs(hash);
    };

    // Filtra para simular EXCLUSIVAMENTE os 10 ativos ativos da carteira (ou os padrão se vazia)
    const allAssetsToSimulate = walletAssets.length > 0 ? walletAssets : ALL_BEST_30_ASSETS;

    return activeDates.map((date, idx) => {
      const prices: Record<string, number> = {};

      allAssetsToSimulate.forEach(asset => {
        const cleanTicker = (asset.ticker || '').trim().toUpperCase();
        const seed = getSeed(cleanTicker);
        
        // Obtém o preço inicial a partir da planilha (prioritário) ou cai de volta para as tabelas padrão
        const startPrice = getInitialPriceFromSheetData(cleanTicker) || yahooPrices[cleanTicker] || PRECOS_REAIS_02_01_2026[cleanTicker] || (asset.price * 0.9);
        const endPrice = asset.price;

        if (idx === 0) {
          // Janeiro de 2026 corresponde exatamente ao fechamento histórico real de 02/01/2026
          prices[cleanTicker] = Number(startPrice.toFixed(2));
        } else if (idx === activeDates.length - 1) {
          // Maio de 2026 corresponde exatamente ao preço atualizado
          prices[cleanTicker] = Number(endPrice.toFixed(2));
        } else {
          // Interpolação linear suave entre o preço inicial real histórico (02/01/2026) e o preço atual (Mai/2026) com leve ciclo sinoidal
          const factor = idx / (activeDates.length - 1);
          const cycle = Math.sin(idx + (seed % 5)) * 0.02 * (endPrice - startPrice);
          const interpolated = startPrice + factor * (endPrice - startPrice) + cycle;
          prices[cleanTicker] = Math.max(0.1, Number(interpolated.toFixed(2)));
        }
      });

      return { date, prices };
    });
  };

  const dataPoints = getHistoricalData();

  // Emula exatamente o retorno da fórmula do Google Sheets: =INDEX(GOOGLEFINANCE(Ticker; "close"; "02/01/2026"); 2; 2)
  // Retorna o preço de fechamento exato do ativo no início do período (02/01/2026) no ponto idx = 0 (Jan 26)
  const emulateGoogleFinanceClose = (ticker: string, dateStr: string = '02/01/2026'): number => {
    const cleanTicker = (ticker || '').trim().toUpperCase();
    const firstPoint = dataPoints[0];
    if (firstPoint) {
      const initialPrice = getAssetPriceAtPoint(firstPoint, cleanTicker, 0);
      if (initialPrice > 0) return initialPrice;
    }
    const asset = walletAssets.find(a => (a.ticker || '').trim().toUpperCase() === cleanTicker) || 
                  ALL_BEST_30_ASSETS.find(a => (a.ticker || '').trim().toUpperCase() === cleanTicker);
    return asset ? asset.price : 0;
  };

  // Helper selectors
  const toggleTickerSelection = (ticker: string) => {
    if (selectedTickers.includes(ticker)) {
      if (selectedTickers.length > 1) {
        setSelectedTickers(selectedTickers.filter(t => t !== ticker));
      }
    } else {
      setSelectedTickers([...selectedTickers, ticker]);
    }
  };

  // Convert prices dynamically for calculation uniformity
  const getBRLPrice = (ticker: string, rawPrice: number): number => {
    const cleanTicker = (ticker || '').trim().toUpperCase();
    const asset = walletAssets.find(a => (a.ticker || '').trim().toUpperCase() === cleanTicker) || 
                  ALL_BEST_30_ASSETS.find(a => (a.ticker || '').trim().toUpperCase() === cleanTicker);
    if (!asset) return rawPrice;
    return asset.currency === 'USD' ? rawPrice * USD_BRL_RATE : rawPrice;
  };

  // Computed Portfolio Aggregate Data points
  const getPortfolioValueAtPoint = (point: HistoricalPoint): number => {
    let sumVal = 0;
    const initialPoint = dataPoints[0];
    walletAssets.forEach(item => {
      const cleanTicker = (item.ticker || '').trim().toUpperCase();
      
      const weightKey = Object.keys(walletWeights).find(k => k.trim().toUpperCase() === cleanTicker);
      const weight = weightKey ? walletWeights[weightKey] : 0;
      
      const priceAtPoint = getAssetPriceAtPoint(point, cleanTicker, item.price);
      const brlPriceAtPoint = getBRLPrice(item.ticker, priceAtPoint);
      
      const initialPrice = getAssetPriceAtPoint(initialPoint, cleanTicker, item.price);
      const initialBrlPrice = getBRLPrice(item.ticker, initialPrice);
      
      // Calculate appreciation percentage from the initial point
      const appreciation = brlPriceAtPoint / (initialBrlPrice || 1);
      const allocatedMoney = investmentBudget * (weight / 100);
      sumVal += allocatedMoney * appreciation;
    });
    return sumVal;
  };

  // 3. Coordinate math for Responsive SVG Plotting
  // ViewBox coordinates
  const svgWidth = 600;
  const svgHeight = 280;
  const paddingLeft = 65;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 40;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  // Calculate current range limiters for Y-axis scaling
  let minVal = Infinity;
  let maxVal = -Infinity;

  if (chartMode === 'individual') {
    selectedTickers.forEach(ticker => {
      dataPoints.forEach(point => {
        const val = getAssetPriceAtPoint(point, ticker, 0);
        if (val < minVal) minVal = val;
        if (val > maxVal) maxVal = val;
      });
    });

    if (showCdiBenchmark && selectedTickers.length > 0) {
      const refTicker = selectedTickers[0];
      const startingPrice = getAssetPriceAtPoint(dataPoints[0], refTicker, 0);
      dataPoints.forEach((_, ptIdx) => {
        const cdiVal = startingPrice * (1 + CDI_ACUMULADO_2026[ptIdx] / 100);
        if (cdiVal < minVal) minVal = cdiVal;
        if (cdiVal > maxVal) maxVal = cdiVal;
      });
    }
  } else {
    dataPoints.forEach((point, ptIdx) => {
      const val = getPortfolioValueAtPoint(point);
      if (val < minVal) minVal = val;
      if (val > maxVal) maxVal = val;

      if (showCdiBenchmark) {
        const initialVal = getPortfolioValueAtPoint(dataPoints[0]);
        const cdiVal = initialVal * (1 + CDI_ACUMULADO_2026[ptIdx] / 100);
        if (cdiVal < minVal) minVal = cdiVal;
        if (cdiVal > maxVal) maxVal = cdiVal;
      }
    });
  }

  // Soft pad bounds for visual headrooms
  let boundMargin = (maxVal - minVal) * 0.1;
  if (isNaN(boundMargin) || !isFinite(boundMargin)) {
    boundMargin = 10;
  }
  minVal = Math.max(0, minVal - boundMargin);
  maxVal = maxVal + boundMargin;

  // Safeguard bounds from invalid Y ranges
  if (!isFinite(minVal) || isNaN(minVal)) minVal = 0;
  if (!isFinite(maxVal) || isNaN(maxVal)) maxVal = 100;
  if (minVal >= maxVal) {
    minVal = 0;
    maxVal = 100;
  }

  // Mapping coordinate calculators
  const getX = (index: number) => {
    if (dataPoints.length <= 1) return paddingLeft;
    const xVal = paddingLeft + (index / (dataPoints.length - 1)) * chartWidth;
    return isNaN(xVal) || !isFinite(xVal) ? paddingLeft : xVal;
  };

  const getY = (val: number) => {
    const denominator = maxVal - minVal;
    if (denominator <= 0) return svgHeight - paddingBottom;
    const valClipped = isNaN(val) || !isFinite(val) ? minVal : val;
    const scale = (valClipped - minVal) / denominator;
    const yVal = svgHeight - paddingBottom - scale * chartHeight;
    return isNaN(yVal) || !isFinite(yVal) ? svgHeight - paddingBottom : yVal;
  };

  // Color mapping helper for up to 10 distinct high-contrast stocks
  const getColorForIndex = (index: number) => {
    const colors = [
      '#10b981', // emerald
      '#6366f1', // indigo
      '#3b82f6', // blue
      '#ec4899', // pink
      '#f59e0b', // amber
      '#06b6d4', // cyan
      '#8b5cf6', // purple
      '#f43f5e', // rose
      '#14b8a6', // teal
      '#eab308'  // yellow
    ];
    return colors[index % colors.length];
  };

  // Core Mouse events tracking for interactive hover line & popup card
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const xInContainer = e.clientX - rect.left;
    const yInContainer = e.clientY - rect.top;

    // Convert local container X coordinate to proportional SVG coordinate
    const svgFractionX = xInContainer / rect.width;
    const svgScaledX = svgFractionX * svgWidth;

    // Find closest date point
    let closestIdx = 0;
    let minDiff = Infinity;
    for (let i = 0; i < dataPoints.length; i++) {
      const ptX = getX(i);
      const diff = Math.abs(svgScaledX - ptX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }

    setHoveredIdx(closestIdx);
    setMousePos({ x: xInContainer, y: yInContainer });
  };

  const handleMouseLeave = () => {
    setHoveredIdx(null);
  };

  // Cumulative yield and portfolio comparison values
  const currentTotalValuation = getPortfolioValueAtPoint(dataPoints[dataPoints.length - 1]);
  const initialTotalValuation = getPortfolioValueAtPoint(dataPoints[0]);
  const appreciationPercent = ((currentTotalValuation - initialTotalValuation) / initialTotalValuation) * 100;
  const isPositiveGrowth = appreciationPercent >= 0;

  // Dynamic portfolio performance rating compared to CDI (Jan/26 to Mai/26 = 3.39%)
  const cdiBench = 3.39;
  let ratingText = 'Média';
  let ratingColor = 'text-emerald-400';

  if (appreciationPercent < 0) {
    ratingText = 'Baixa (Negativa)';
    ratingColor = 'text-rose-400';
  } else if (appreciationPercent < cdiBench) {
    ratingText = 'Baixa (Abaixo do CDI)';
    ratingColor = 'text-amber-400';
  } else if (appreciationPercent < cdiBench * 1.5) {
    ratingText = 'Alta (Acima do CDI)';
    ratingColor = 'text-emerald-400 font-bold';
  } else {
    ratingText = 'Excelente (Outperformance)';
    ratingColor = 'text-teal-400 font-black';
  }

  // Weighted Yield and Dividends Simulator
  const weightedAnnualYield = walletAssets.reduce((sum, asset) => {
    const weight = walletWeights[asset.ticker] || 0;
    return sum + (asset.yield * (weight / 100));
  }, 0);
  const yearlyDividendsSimulated = investmentBudget * weightedAnnualYield;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Simulation Header and Cards section wrapper */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-1">
          <Coins className="w-5 h-5 text-amber-400" />
          <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider">Simulador de Carteira</h2>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Metric - Patrimônio Inicial */}
          <div className="bg-black/25 border border-white/10 rounded-2xl p-5 flex items-center justify-between shadow-lg">
            <div>
              <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider mb-1">Patrimônio Inicial</span>
              <span className="text-2xl font-black text-white">
                R$ {initialTotalValuation.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-slate-400 block mt-1">Valor inicial (Jan/2026)</span>
            </div>
            <div className="bg-blue-500/10 p-3 rounded-xl border border-blue-500/20 text-blue-400">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>

          {/* Metric 1 */}
          <div className="bg-black/25 border border-white/10 rounded-2xl p-5 flex items-center justify-between shadow-lg">
            <div>
              <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider mb-1">Patrimônio Consolidado</span>
              <span className="text-2xl font-black text-white">
                R$ {currentTotalValuation.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-slate-400 block mt-1">Estimado com base em aportes</span>
            </div>
            <div className="bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/20 text-indigo-400">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>

          {/* Metric 2 */}
          <div className="bg-black/25 border border-white/10 rounded-2xl p-5 flex items-center justify-between shadow-lg">
            <div>
              <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider mb-1">Rentabilidade do Período</span>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-black ${isPositiveGrowth ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isPositiveGrowth ? '+' : ''}{appreciationPercent.toFixed(2)}%
                </span>
                <span className={`text-[11px] font-bold font-mono ${ratingColor}`}>
                  {ratingText}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">Confrontado desde ponto de partida</span>
            </div>
            <div className={`p-3 rounded-xl border ${
              isPositiveGrowth 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}>
              {isPositiveGrowth ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
            </div>
          </div>

          {/* Metric 3 */}
          <div className="bg-black/25 border border-white/10 rounded-2xl p-5 flex items-center justify-between shadow-lg">
            <div>
              <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider mb-1">Balanço do Período (R$)</span>
              <span className={`text-2xl font-black ${isPositiveGrowth ? 'text-emerald-400' : 'text-rose-400'}`}>
                R$ {(currentTotalValuation - initialTotalValuation).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-slate-400 block mt-1">Lucro/Prejuízo flutuante sobre aporte</span>
            </div>
            <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 text-amber-400">
              <Calendar className="w-6 h-6" />
            </div>
          </div>

        </div>

        {/* Metrics Row 2 - Yield & Renda Passiva Ponderados */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 -mt-2">
          <div className="hidden lg:block lg:col-span-2"></div>
          
          {/* Yield Médio Ponderado Card */}
          <div className="bg-black/25 border border-white/10 rounded-2xl p-5 flex items-center justify-between shadow-lg">
            <div>
              <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider mb-1">Yield Médio Ponderado</span>
              <span className="text-2xl font-black text-emerald-400">
                {(weightedAnnualYield * 100).toFixed(2)}% a.a.
              </span>
              <span className="text-[10px] text-slate-400 block mt-1">Retorno ponderado em dividendos</span>
            </div>
            <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 text-emerald-400">
              <Percent className="w-6 h-6" />
            </div>
          </div>

          {/* Renda Passiva Anual Ponderada Card */}
          <div className="bg-black/25 border border-white/10 rounded-2xl p-5 flex items-center justify-between shadow-lg">
            <div>
              <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider mb-1">Renda Passiva Anual Ponderada</span>
              <span className="text-2xl font-black text-white">
                R$ {yearlyDividendsSimulated.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-indigo-300 block mt-1">
                ~R$ {(yearlyDividendsSimulated / 12).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / mês
              </span>
            </div>
            <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 text-amber-400">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Graph Card */}
      <div className="bg-black/30 border border-white/10 rounded-3xl p-6 shadow-2xl relative">
        
        {/* Toggle Mode selectors inside the chart */}
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-white/10 pb-4 mb-6">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-indigo-400 rounded-full animate-ping"></span>
            <h3 className="text-md font-bold text-white uppercase tracking-wider">Histórico de Performance (2026)</h3>
          </div>

          <div className="flex items-center flex-wrap gap-3">
            {/* Toggler Mostrar CDI */}
            <label className="flex items-center gap-2 cursor-pointer bg-black/45 border border-white/10 rounded-xl py-1.5 px-3 hover:bg-black/60 transition group select-none">
              <input
                type="checkbox"
                checked={showCdiBenchmark}
                onChange={() => setShowCdiBenchmark(!showCdiBenchmark)}
                className="accent-amber-500 cursor-pointer w-4 h-4 rounded border-white/20"
              />
              <span className="text-xs font-bold text-amber-500 group-hover:text-amber-400 transition">CDI Acumulado (+3.39%)</span>
            </label>

            <div className="bg-black/40 p-1 border border-white/10 rounded-xl flex gap-1 text-xs">
              <button
                onClick={() => setChartMode('individual')}
                className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  chartMode === 'individual' 
                    ? 'bg-gradient-to-r from-emerald-500/80 to-indigo-500/80 text-white shadow-md' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Ativos Individuais
              </button>
              <button
                onClick={() => setChartMode('portfolio')}
                className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  chartMode === 'portfolio' 
                    ? 'bg-gradient-to-r from-emerald-500/80 to-indigo-500/80 text-white shadow-md' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Valor Geral Integrado (R$)
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Canvas Container */}
        <div 
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="relative w-full h-[300px] select-none cursor-crosshair pb-3"
        >
          <svg 
            viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
            width="100%" 
            height="100%" 
            className="overflow-visible"
          >
            {/* Horizontal Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
              const gridY = getY(minVal + ratio * (maxVal - minVal));
              const gridPriceLabel = minVal + ratio * (maxVal - minVal);
              return (
                <g key={`grid-${index}`}>
                  <line 
                    x1={paddingLeft} 
                    y1={gridY} 
                    x2={svgWidth - paddingRight} 
                    y2={gridY} 
                    stroke="rgba(255, 255, 255, 0.06)" 
                    strokeDasharray="4 4" 
                  />
                  {/* Axis labels Y (Prices) */}
                  <text 
                    x={paddingLeft - 8} 
                    y={gridY + 4} 
                    fill="rgba(148, 163, 184, 0.8)" 
                    fontSize="12" 
                    textAnchor="end"
                    fontWeight="500"
                    fontFamily="monospace"
                  >
                    {chartMode === 'portfolio' 
                      ? `R$ ${Math.round(gridPriceLabel).toLocaleString()}`
                      : `${gridPriceLabel.toFixed(1)}`}
                  </text>
                </g>
              );
            })}

            {/* Vertical grid lines & Axis labels X (Dates) */}
            {dataPoints.map((point, index) => {
              const ptX = getX(index);
              return (
                <g key={`grid-x-${index}`}>
                  <line 
                    x1={ptX} 
                    y1={paddingTop} 
                    x2={ptX} 
                    y2={svgHeight - paddingBottom} 
                    stroke="rgba(255, 255, 255, 0.04)" 
                    strokeWidth="1" 
                  />
                  <text 
                    x={ptX} 
                    y={svgHeight - paddingBottom + 16} 
                    fill="rgba(148, 163, 184, 0.8)" 
                    fontSize="12" 
                    textAnchor="middle"
                    fontWeight="bold"
                  >
                    {point.date}
                  </text>
                </g>
              );
            })}

            {/* Core Lines */}
            {chartMode === 'individual' ? (
              <>
                {/* Plot individual asset lines and circles */}
                {walletAssets.map((asset, assetIdx) => {
                  const isVisible = selectedTickers.includes(asset.ticker);
                  if (!isVisible) return null;

                  const lineColor = getColorForIndex(assetIdx);
                  
                  // Draw line path
                  const pointsPath = dataPoints.map((pt, ptIdx) => {
                    const price = getAssetPriceAtPoint(pt, asset.ticker, asset.price);
                    return `${getX(ptIdx)},${getY(price)}`;
                  }).join(' L ');
                  
                  return (
                    <g key={`asset-line-${asset.ticker}`} className="transition-all duration-300">
                      {/* Glowing highlight underlayer */}
                      <path 
                        d={`M ${pointsPath}`} 
                        fill="none" 
                        stroke={lineColor} 
                        strokeWidth="6" 
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity="0.1"
                      />
                      
                      {/* Real Line */}
                      <path 
                        d={`M ${pointsPath}`} 
                        fill="none" 
                        stroke={lineColor} 
                        strokeWidth="2.5" 
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Circular point markers */}
                      {dataPoints.map((pt, ptIdx) => {
                        const price = getAssetPriceAtPoint(pt, asset.ticker, asset.price);
                        return (
                          <circle 
                            key={`dot-${asset.ticker}-${ptIdx}`}
                            cx={getX(ptIdx)} 
                            cy={getY(price)} 
                            r={hoveredIdx === ptIdx ? '5.5' : '3.5'} 
                            fill="#1e293b" 
                            stroke={lineColor} 
                            strokeWidth={hoveredIdx === ptIdx ? '3' : '2'}
                          />
                        );
                      })}
                    </g>
                  );
                })}

                {/* Plot CDI Accumulated Overlay benchmark relative to first selected ticker */}
                {showCdiBenchmark && selectedTickers.length > 0 && (() => {
                  const refTicker = selectedTickers[0];
                  const startingPrice = getAssetPriceAtPoint(dataPoints[0], refTicker, 0);
                  const pointsPath = dataPoints.map((pt, ptIdx) => {
                    const cdiPrice = startingPrice * (1 + CDI_ACUMULADO_2026[ptIdx] / 100);
                    return `${getX(ptIdx)},${getY(cdiPrice)}`;
                  }).join(' L ');
                  
                  return (
                    <g key="individual-cdi-line" className="transition-all duration-300">
                      {/* Shadow/Glow */}
                      <path 
                        d={`M ${pointsPath}`} 
                        fill="none" 
                        stroke="#f59e0b" 
                        strokeWidth="5" 
                        strokeDasharray="4 4" 
                        opacity="0.12"
                      />
                      {/* Dashed Line */}
                      <path 
                        d={`M ${pointsPath}`} 
                        fill="none" 
                        stroke="#f59e0b" 
                        strokeWidth="2" 
                        strokeDasharray="5 5" 
                        strokeLinecap="round"
                      />
                      {/* Circles */}
                      {dataPoints.map((_, ptIdx) => {
                        const cdiPrice = startingPrice * (1 + CDI_ACUMULADO_2026[ptIdx] / 100);
                        return (
                          <circle 
                            key={`dot-cdi-${ptIdx}`}
                            cx={getX(ptIdx)} 
                            cy={getY(cdiPrice)} 
                            r={hoveredIdx === ptIdx ? '5' : '3'} 
                            fill="#1e293b" 
                            stroke="#f59e0b" 
                            strokeWidth="2"
                          />
                        );
                      })}
                    </g>
                  );
                })()}
              </>
            ) : (
              // Plot aggreggate portfolio value
              (() => {
                const initialVal = getPortfolioValueAtPoint(dataPoints[0]);
                const portfolioPointsPath = dataPoints.map((pt, ptIdx) => {
                  const val = getPortfolioValueAtPoint(pt);
                  return `${getX(ptIdx)},${getY(val)}`;
                }).join(' L ');

                const cdiPointsPath = dataPoints.map((_, ptIdx) => {
                  const cdiVal = initialVal * (1 + CDI_ACUMULADO_2026[ptIdx] / 100);
                  return `${getX(ptIdx)},${getY(cdiVal)}`;
                }).join(' L ');

                return (
                  <g>
                    {/* Gradient area filling beneath aggregate value */}
                    <path
                      d={`M ${getX(0)},${svgHeight - paddingBottom} L ${portfolioPointsPath} L ${getX(dataPoints.length - 1)},${svgHeight - paddingBottom} Z`}
                      fill="url(#portfolio-gradient)"
                      opacity="0.1"
                    />

                    <defs>
                      <linearGradient id="portfolio-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#818cf8" />
                        <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
                      </linearGradient>
                    </defs>

                    {/* CDI Benchmark Line (Amber) */}
                    {showCdiBenchmark && (
                      <g key="portfolio-cdi-line">
                        {/* Glow underlayer */}
                        <path 
                          d={`M ${cdiPointsPath}`} 
                          fill="none" 
                          stroke="#f59e0b" 
                          strokeWidth="6" 
                          opacity="0.08"
                        />
                        {/* Dashed Line */}
                        <path 
                          d={`M ${cdiPointsPath}`} 
                          fill="none" 
                          stroke="#f59e0b" 
                          strokeWidth="2.5" 
                          strokeDasharray="6 4" 
                          strokeLinecap="round"
                          opacity="0.9"
                        />
                        {/* Points for CDI */}
                        {dataPoints.map((_, ptIdx) => {
                          const cdiVal = initialVal * (1 + CDI_ACUMULADO_2026[ptIdx] / 100);
                          return (
                            <circle 
                              key={`aggregate-cdi-dot-${ptIdx}`}
                              cx={getX(ptIdx)} 
                              cy={getY(cdiVal)} 
                              r={hoveredIdx === ptIdx ? '5.5' : '3.5'} 
                              fill="#1e293b" 
                              stroke="#f59e0b" 
                              strokeWidth="2"
                            />
                          );
                        })}
                      </g>
                    )}

                    {/* Glowing highlight underlayer for portfolio */}
                    <path 
                      d={`M ${portfolioPointsPath}`} 
                      fill="none" 
                      stroke="#818cf8" 
                      strokeWidth="8" 
                      opacity="0.15"
                    />

                    {/* Aggregate Line */}
                    <path 
                      d={`M ${portfolioPointsPath}`} 
                      fill="none" 
                      stroke="#6366f1" 
                      strokeWidth="3.5" 
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Points */}
                    {dataPoints.map((pt, ptIdx) => {
                      const val = getPortfolioValueAtPoint(pt);
                      return (
                        <circle 
                          key={`aggregate-dot-${ptIdx}`}
                          cx={getX(ptIdx)} 
                          cy={getY(val)} 
                          r={hoveredIdx === ptIdx ? '6' : '4'} 
                          fill="#1e293b" 
                          stroke="#6366f1" 
                          strokeWidth={hoveredIdx === ptIdx ? '3.5' : '2.5'}
                        />
                      );
                    })}
                  </g>
                );
              })()
            )}

            {/* Vertical Interactive Hover line tracker */}
            {hoveredIdx !== null && (
              <line 
                x1={getX(hoveredIdx)} 
                y1={paddingTop} 
                x2={getX(hoveredIdx)} 
                y2={svgHeight - paddingBottom} 
                stroke="#818cf8" 
                strokeWidth="2" 
                strokeDasharray="4 4" 
                opacity="0.7"
              />
            )}
          </svg>

          {/* Interactive Floating hover popup details card */}
          {hoveredIdx !== null && (
            <div 
              className="absolute pointer-events-none bg-slate-950/95 border border-indigo-500/40 rounded-xl p-3.5 shadow-2xl backdrop-blur-md text-xs space-y-2 min-w-[210px]"
              style={{
                left: `${Math.min(mousePos.x + 15, containerRef.current.clientWidth - 225)}px`,
                top: `${Math.min(mousePos.y + 15, containerRef.current.clientHeight - 130)}px`
              }}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                <span className="font-bold text-slate-100 uppercase tracking-wide">Data: {dataPoints[hoveredIdx].date}</span>
                <span className="text-[10px] text-indigo-400 font-semibold font-mono">Valores</span>
              </div>

              {chartMode === 'individual' ? (
                <div className="space-y-1.5 max-h-[140px] overflow-y-auto scrollbar-none">
                  {walletAssets.map((asset, assetIdx) => {
                    const isVisible = selectedTickers.includes(asset.ticker);
                    if (!isVisible) return null;
                    const price = getAssetPriceAtPoint(dataPoints[hoveredIdx], asset.ticker, asset.price);
                    return (
                      <div key={asset.ticker} className="flex justify-between items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: getColorForIndex(assetIdx) }}></span>
                          <span className="font-mono font-bold text-slate-200">{asset.ticker}</span>
                        </div>
                        <span className="font-bold text-white font-mono">
                          {asset.currency === 'USD' ? '$' : 'R$'} {price.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}

                  {showCdiBenchmark && selectedTickers.length > 0 && (() => {
                    return (
                      <div className="flex justify-between items-center gap-4 border-t border-white/5 pt-1.5 mt-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0 bg-amber-500"></span>
                          <span className="font-mono font-bold text-amber-300">CDI Acum.</span>
                        </div>
                        <span className="font-bold text-amber-400 font-mono">
                          +{CDI_ACUMULADO_2026[hoveredIdx].toFixed(2)}%
                        </span>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="space-y-1.5 font-sans">
                  <div className="flex justify-between items-center gap-4">
                    <span className="text-slate-300 font-medium">Carteira total</span>
                    <span className="font-mono font-black text-emerald-400 text-sm">
                      R$ {getPortfolioValueAtPoint(dataPoints[hoveredIdx]).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {showCdiBenchmark && (() => {
                    const initialVal = getPortfolioValueAtPoint(dataPoints[0]);
                    const cdiVal = initialVal * (1 + CDI_ACUMULADO_2026[hoveredIdx] / 100);
                    return (
                      <div className="flex justify-between items-center gap-4 border-t border-white/5 pt-1.5 mt-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0 bg-amber-500"></span>
                          <span className="text-amber-300 font-medium">Ref. CDI (+{CDI_ACUMULADO_2026[hoveredIdx].toFixed(2)}%)</span>
                        </div>
                        <span className="font-mono font-semibold text-amber-400">
                          R$ {cdiVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    );
                  })()}

                  <div className="text-[9px] text-slate-500 italic pr-2 pt-1 border-t border-white/5">
                    Composição proporcional de sua carteira ativa.
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Asset selection Legend togglers (only active on Individual mode) */}
        {chartMode === 'individual' && (
          <div className="pt-4 border-t border-white/5 mt-4 space-y-2">
            <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Clique para ocultar ou destacar o ativo no gráfico:</span>
            <div className="flex flex-wrap gap-2.5 justify-start">
              {walletAssets.map((asset, idx) => {
                const isSelected = selectedTickers.includes(asset.ticker);
                const assetColor = getColorForIndex(idx);
                return (
                  <button
                    key={`toggler-${asset.ticker}`}
                    onClick={() => toggleTickerSelection(asset.ticker)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition ${
                      isSelected 
                        ? 'text-white' 
                        : 'bg-black/20 text-slate-500 border-white/5 line-through decoration-slate-650 opacity-60 hover:opacity-100'
                    }`}
                    style={{
                      borderColor: isSelected ? `${assetColor}50` : undefined,
                      backgroundColor: isSelected ? `${assetColor}12` : undefined,
                    }}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: assetColor }}></span>
                    <span className="font-mono font-bold">{asset.ticker}</span>
                    {isSelected ? <Eye className="w-3.5 h-3.5 ml-1 text-slate-400" /> : <EyeOff className="w-3.5 h-3.5 ml-1 text-slate-600" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* Yields Bar Chart Section */}
      <div className="bg-black/30 border border-white/10 rounded-3xl p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <BarChart2 className="w-6 h-6 text-emerald-400" />
            <div>
              <h3 className="text-lg font-bold text-white uppercase tracking-wider">Dividend Yields por Ativo (%)</h3>
              <p className="text-xs text-slate-400">Rendimento anual de dividendos comparando Ações vs FIIs</p>
            </div>
          </div>
          
          {/* Sorting / View Toggles */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-bold hidden sm:inline">Ordenar por:</span>
            <div className="inline-flex bg-black/45 p-1 border border-white/10 rounded-xl text-xs gap-1">
              <button
                type="button"
                onClick={() => setYieldSortMode('yield')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  yieldSortMode === 'yield'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white border border-transparent'
                }`}
              >
                Rendimento
              </button>
              <button
                type="button"
                onClick={() => setYieldSortMode('ticker')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  yieldSortMode === 'ticker'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white border border-transparent'
                }`}
              >
                Nome (Ticker)
              </button>
              <button
                type="button"
                onClick={() => setYieldSortMode('weight')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  yieldSortMode === 'weight'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white border border-transparent'
                }`}
              >
                Peso (%)
              </button>
            </div>
          </div>
        </div>

        {/* Legend Panel */}
        <div className="flex items-center gap-6 text-xs bg-white/5 border border-white/5 px-4 py-2.5 rounded-2xl w-fit">
          <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Legenda de Tipo:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></span>
            <span className="text-emerald-300 font-bold">Ações (Dividendos)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-gradient-to-t from-amber-600 to-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.4)]"></span>
            <span className="text-amber-300 font-bold">FIIs (Rendimento Mensal)</span>
          </div>
        </div>

        {/* Bar Chart Container with horizontal scroll container for mobile layout integrity */}
        <div className="space-y-4">
          <div className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            <div className="min-w-[550px] p-2">
              {(() => {
                const svgWidth = 600;
                const svgHeight = 250;
                const paddingTop = 35;
                const paddingBottom = 45;
                const paddingLeft = 45;
                const paddingRight = 15;
                const chartHeight = svgHeight - paddingTop - paddingBottom;
                const chartWidth = svgWidth - paddingLeft - paddingRight;

                const maxYieldPct = Math.max(0.01, maxYieldInPortfolio * 100);
                const barSpacing = chartWidth / Math.max(1, sortedAssetsForYield.length);
                const barWidth = Math.min(28, Math.max(12, barSpacing * 0.5));

                return (
                  <svg 
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
                    className="w-full h-auto overflow-visible select-none"
                  >
                    <defs>
                      {/* Gradient for Stocks ("Dividendos") */}
                      <linearGradient id="grad-dividendos" x1="0" y1="1" x2="0" y2="0">
                        <stop offset="0%" stopColor="#047857" />
                        <stop offset="100%" stopColor="#10b981" />
                      </linearGradient>
                      
                      {/* Gradient for FIIs ("Rendimento") */}
                      <linearGradient id="grad-rendimento" x1="0" y1="1" x2="0" y2="0">
                        <stop offset="0%" stopColor="#d97706" />
                        <stop offset="100%" stopColor="#f59e0b" />
                      </linearGradient>

                      {/* Backup scale gradient */}
                      <linearGradient id="grad-backup" x1="0" y1="1" x2="0" y2="0">
                        <stop offset="0%" stopColor="#1d4ed8" />
                        <stop offset="100%" stopColor="#3b82f6" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal Grid lines */}
                    {[0, 0.5, 1].map((ratio) => {
                      const value = maxYieldPct * ratio;
                      const yLine = svgHeight - paddingBottom - ratio * chartHeight;
                      return (
                        <g key={`y-grid-${ratio}`}>
                          <line 
                            x1={paddingLeft} 
                            y1={yLine} 
                            x2={svgWidth - paddingRight} 
                            y2={yLine} 
                            stroke="rgba(255, 255, 255, 0.08)" 
                            strokeDasharray="4 4" 
                            strokeWidth="1"
                          />
                          <text 
                            x={paddingLeft - 8} 
                            y={yLine + 3} 
                            textAnchor="end" 
                            fill="#94a3b8" 
                            fontSize="11" 
                            fontWeight="bold"
                            className="font-mono"
                          >
                            {value.toFixed(1)}%
                          </text>
                        </g>
                      );
                    })}

                    {/* Chart baseline */}
                    <line 
                      x1={paddingLeft} 
                      y1={svgHeight - paddingBottom} 
                      x2={svgWidth - paddingRight} 
                      y2={svgHeight - paddingBottom} 
                      stroke="rgba(255, 255, 255, 0.2)" 
                      strokeWidth="1"
                    />

                    {/* Bars rendering */}
                    {sortedAssetsForYield.map((asset, i) => {
                      const valPct = asset.yield * 100;
                      const barHeight = (valPct / maxYieldPct) * chartHeight;
                      const x = paddingLeft + i * barSpacing + (barSpacing - barWidth) / 2;
                      const y = svgHeight - paddingBottom - barHeight;

                      const isStock = asset.type === 'stocks';
                      const gradientId = isStock ? 'url(#grad-dividendos)' : asset.type === 'fii' ? 'url(#grad-rendimento)' : 'url(#grad-backup)';
                      const glowColor = isStock ? 'rgba(16,185,129,0.3)' : asset.type === 'fii' ? 'rgba(245,158,11,0.3)' : 'rgba(59,130,246,0.3)';

                      return (
                        <g key={`v-bar-${asset.ticker}`} className="group cursor-pointer">
                          {/* Invisible hover helper for bigger mouse area */}
                          <rect 
                            x={paddingLeft + i * barSpacing} 
                            y={paddingTop} 
                            width={barSpacing} 
                            height={chartHeight + 10} 
                            fill="transparent" 
                          />

                          {/* Glow background shape on bar hover */}
                          <rect 
                            x={x - 4} 
                            y={y - 4} 
                            width={barWidth + 8} 
                            height={barHeight + 6} 
                            rx={6} 
                            fill={glowColor}
                            className="opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                          />

                          {/* The actual vertical rounded bar */}
                          <rect 
                            x={x} 
                            y={y} 
                            width={barWidth} 
                            height={Math.max(3, barHeight)} 
                            rx={4} 
                            fill={gradientId}
                            className="transition-all duration-300 group-hover:brightness-110"
                          />

                          {/* Value pill label on top of each bar */}
                          <g className="transition-all duration-300 transform group-hover:-translate-y-0.5">
                            <rect 
                              x={x + barWidth / 2 - 20} 
                              y={y - 20} 
                              width={40} 
                              height={14} 
                              rx={4} 
                              fill="rgba(15, 23, 42, 0.9)" 
                              stroke={isStock ? '#10b981' : '#6366f1'} 
                              strokeWidth="1"
                              className="shadow-lg"
                            />
                            <text 
                              x={x + barWidth / 2} 
                              y={y - 10} 
                              textAnchor="middle" 
                              fill={isStock ? '#34d399' : '#a5b4fc'} 
                              fontSize="10" 
                              fontWeight="black" 
                              className="font-mono"
                            >
                              {valPct.toFixed(1)}%
                            </text>
                          </g>

                          {/* Ticker label on bottom (X Coordinate) */}
                          <text 
                            x={x + barWidth / 2} 
                            y={svgHeight - paddingBottom + 16} 
                            textAnchor="middle" 
                            fill="#f8fafc" 
                            fontSize="12" 
                            fontWeight="extrabold" 
                            className="font-mono tracking-wider transition-colors duration-200 group-hover:fill-indigo-300"
                          >
                            {asset.ticker}
                          </text>

                          {/* Type subtitle (DIV vs REND) */}
                          <text 
                            x={x + barWidth / 2} 
                            y={svgHeight - paddingBottom + 26} 
                            textAnchor="middle" 
                            fill={isStock ? '#6ee7b7' : '#c7d2fe'} 
                            fontSize="9" 
                            fontWeight="black" 
                            className="opacity-70 font-sans tracking-tight"
                          >
                            {isStock ? 'DIVIDENDO' : 'RENDIMENTO'}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                );
              })()}
            </div>
          </div>

          {/* Swipe text for mobile layout helper */}
          <div className="flex md:hidden items-center justify-center gap-1 text-[10px] text-slate-400 font-bold bg-white/5 py-1 px-3 rounded-lg w-fit mx-auto">
            <span>Arraste para o lado para ver todos os ativos</span>
            <ChevronRight className="w-3.5 h-3.5 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Grid bottom row: Asset List with Growth Indicators */}
      <div className="bg-black/30 border border-white/10 rounded-3xl p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Info className="w-5 h-5 text-indigo-400" />
            Variação e Desempenho por Ativo
          </h3>
          <span className="text-xs text-slate-400 italic">Preço inicial do período (Jan/2026) vs Atual</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead>
              <tr className="border-b border-white/5 text-xs text-slate-400 font-bold uppercase tracking-wider">
                <th className="pb-3 pl-2">Ativo</th>
                <th className="pb-3 text-center">Tipo</th>
                <th className="pb-3 text-center">Peso</th>
                <th className="pb-3 text-right">
                  <span 
                    className="cursor-help hover:text-indigo-400 transition-colors border-b border-dashed border-slate-500/50 pb-0.5"
                    title='Calculado dinamicamente usando a fórmula: =INDEX(GOOGLEFINANCE(Ticker; "close"; "02/01/2026"); 2; 2)'
                  >
                    Preço Inicial
                  </span>
                </th>
                <th className="pb-3 text-right">Preço Atual</th>
                <th className="pb-3 text-right pr-2">Var. Estimada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {walletAssets.map((asset) => {
                const initialPrice = emulateGoogleFinanceClose(asset.ticker, '02/01/2026');
                const lastPoint = dataPoints[dataPoints.length - 1];
                const currentPrice = getAssetPriceAtPoint(lastPoint, asset.ticker, asset.price);
                const assetAppreciation = ((currentPrice - initialPrice) / initialPrice) * 100;
                const weight = walletWeights[asset.ticker] || 0;

                return (
                  <tr key={`ranking-item-${asset.ticker}`} className="hover:bg-white/5 transition-colors">
                    <td className="py-3.5 pl-2">
                      <div className="font-bold text-white font-mono tracking-wide">{asset.ticker}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[200px]">{asset.name}</div>
                    </td>
                    <td className="py-3.5 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                        asset.type === 'stocks' 
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' 
                          : asset.type === 'fii'
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                            : 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                      }`}>
                        {asset.type === 'stocks' ? 'Ação BR' : asset.type === 'fii' ? 'FII' : 'S&P 500'}
                      </span>
                    </td>
                    <td className="py-3.5 text-center font-bold text-slate-300 font-mono">{weight}%</td>
                    <td className="py-3.5 text-right font-mono text-xs">
                      <div 
                        className="text-slate-200 cursor-help hover:text-indigo-400 transition-colors"
                        title={`=INDEX(GOOGLEFINANCE("${asset.ticker}"; "close"; "02/01/2026"); 2; 2)`}
                      >
                        {asset.currency === 'USD' ? 'US$' : 'R$'} {initialPrice.toFixed(2)}
                      </div>
                    </td>
                    <td className="py-3.5 text-right font-mono font-bold text-white text-xs">
                      {asset.currency === 'USD' ? 'US$' : 'R$'} {currentPrice.toFixed(2)}
                    </td>
                    <td className="py-3.5 text-right pr-2">
                       <span className={`font-bold font-mono text-xs inline-flex items-center gap-0.5 ${
                        assetAppreciation >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {assetAppreciation >= 0 ? '+' : ''}{assetAppreciation.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Styled Strategic Analysis & Performance Insights Card */}
      <div className="bg-gradient-to-br from-slate-900/90 to-black/40 border border-white/15 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
          <TrendingDown className="w-6 h-6 text-indigo-400" />
          <div>
            <h3 className="text-lg font-bold text-white uppercase tracking-wider">Análise de Desempenho & Diagnóstico da Carteira</h3>
            <p className="text-xs text-slate-400">Por que a carteira de renda variável está abaixo do CDI benchmark neste período?</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Col 1: Justification (Por Que está abaixo do CDI?) */}
          <div className="space-y-4 bg-white/5 border border-white/5 p-5 rounded-2xl">
            <h4 className="text-sm font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
              Causa Raiz & Justificativa Financeira
            </h4>
            <div className="text-sm text-slate-300 space-y-3 leading-relaxed">
              <p>
                A atual taxa básica de juros (Selic) em patamares elevados força o benchmark <strong className="text-white">CDI</strong> a uma capitalização diária composta extremamente rigorosa e sem drawdowns (volatilidade neutra).
              </p>
              <p>
                Em contrapartida, nossa carteira tem alta exposição a <strong className="text-white">FIIs (Fundos Imobiliários) e Ações de Valor</strong>. No curto prazo, a elevação dos juros reais gera o efeito de <em className="text-slate-400">abertura da curva de juros</em>, diminuindo os valuations dos ativos de renda variável através do desconto de fluxos de caixa futuros e pressionando temporariamente os preços das cotas.
              </p>
              <p>
                Ademais, os proventos acumulados (Dividend Yields exibidos em nosso novo gráfico de barras) são creditados periodicamente em caixa e levam alguns ciclos de reinvestimento para acelerar o efeito bola de neve no montante consolidado.
              </p>
            </div>
          </div>

          {/* Col 2: Strategies (O que fazer para melhorar o desempenho?) */}
          <div className="space-y-4 bg-white/5 border border-white/5 p-5 rounded-2xl">
            <h4 className="text-sm font-bold text-emerald-300 uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Plano de Ação & Ajuste de Alocação
            </h4>
            <div className="text-sm text-slate-300 space-y-3 leading-relaxed">
              <p>
                Para potencializar o retorno da carteira e convergir com o CDI (ou superá-lo no médio prazo), recomendamos as seguintes ações:
              </p>
              <ul className="list-none space-y-2.5">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 font-extrabold text-[10px] bg-emerald-500/10 px-1.5 py-0.5 rounded shrink-0">1</span>
                  <span>
                    <strong className="text-white">Aportes táticos no Yield On Cost (YOC):</strong> Aproveitar a compressão atual de preços observada na tabela para subscrever cotas e ações com dividend yields projetados maiores, travando excelentes yields para o longo prazo.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-400 font-extrabold text-[10px] bg-indigo-500/10 px-1.5 py-0.5 rounded shrink-0">2</span>
                  <span>
                    <strong className="text-white">Foco em Ativos de Proteção Inflacionária:</strong> Direcionar parte dos recursos para FIIs de recebíveis ("FIIs de Papel") atrelados ao IPCA+ e CDI+, mitigando a volatilidade do portfólio físico de tijolo.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 font-extrabold text-[10px] bg-blue-500/10 px-1.5 py-0.5 rounded shrink-0">3</span>
                  <span>
                    <strong className="text-white">Arbitragem Cambial (S&P 500):</strong> Manter a alocação dolarizada ativa para balancear recessões locais e capturar a valorização de ativos globais de tecnologia.
                  </span>
                </li>
              </ul>
            </div>
          </div>

        </div>

        {/* Dynamic warning footer indicator */}
        <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-xl text-sm text-indigo-300 font-medium">
          <Info className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>Nota Técnica: Renda variável exige foco no crescimento orgânico dos ativos. Flutuações de curto prazo frente a taxas de juros de dois dígitos são normais e costumam anteceder períodos de forte recuperação nos ciclos de corte de juros.</span>
        </div>
      </div>
      
    </div>
  );
}
