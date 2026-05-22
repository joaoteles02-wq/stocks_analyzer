import { useState, useEffect, useRef } from 'react';
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
  Info
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
  const [investmentBudget, setInvestmentBudget] = useState<number>(25000);

  useEffect(() => {
    // Read budget
    const savedBudget = localStorage.getItem('saved_wallet_budget');
    if (savedBudget) {
      setInvestmentBudget(Number(savedBudget));
    }

    // Read wallet
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

  // CDI accumulated monthly rates for 2026: Jan/26 (0.0%), Fev/26 (+0.82%), Mar/26 (+1.68%), Abr/26 (+2.53%), Mai/26 (+3.39%)
  const CDI_ACUMULADO_2026 = [0.0, 0.82, 1.68, 2.53, 3.39];

  // Deterministic generator of historical data points for consistent displays starting in Jan 2026
  const getHistoricalData = (): HistoricalPoint[] => {
    const activeDates = ['Jan 26', 'Fev 26', 'Mar 26', 'Abr 26', 'Mai 26'];

    // Use ticker name to hash a seed
    const getSeed = (str: string) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
      }
      return Math.abs(hash);
    };

    return activeDates.map((date, idx) => {
      const prices: Record<string, number> = {};

      ALL_BEST_30_ASSETS.forEach(asset => {
        const seed = getSeed(asset.ticker);
        // Base fluctuation
        const trend = (seed % 10) / 100 - 0.03; // -3% to +7% trend growth
        const cycle = Math.sin(idx + (seed % 5)) * 0.06; // cyclical oscillation
        const randomNoise = ((seed * (idx + 13)) % 100) / 3000; // micro variance

        // Current price should match base asset price exactly at the final point (index 4)
        if (idx === activeDates.length - 1) {
          prices[asset.ticker] = asset.price;
        } else {
          // Backward construct price
          const distanceToLast = (activeDates.length - 1) - idx;
          const discountedFactor = 1 - (trend * distanceToLast) + (cycle * (distanceToLast * 0.4)) + randomNoise;
          const calculatedPrice = asset.price * discountedFactor;
          prices[asset.ticker] = Math.max(0.1, Number(calculatedPrice.toFixed(2)));
        }
      });

      return { date, prices };
    });
  };

  const dataPoints = getHistoricalData();

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
    const asset = ALL_BEST_30_ASSETS.find(a => a.ticker === ticker);
    if (!asset) return rawPrice;
    return asset.currency === 'USD' ? rawPrice * USD_BRL_RATE : rawPrice;
  };

  // Computed Portfolio Aggregate Data points
  const getPortfolioValueAtPoint = (point: HistoricalPoint): number => {
    let sumVal = 0;
    walletAssets.forEach(item => {
      const weight = walletWeights[item.ticker] || 0;
      const priceAtPoint = point.prices[item.ticker] || item.price;
      const brlPriceAtPoint = getBRLPrice(item.ticker, priceAtPoint);
      const initialBrlPrice = getBRLPrice(item.ticker, item.price);
      
      // Calculate appreciation percentage from this point
      const appreciation = brlPriceAtPoint / initialBrlPrice;
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
        const val = point.prices[ticker] || 0;
        if (val < minVal) minVal = val;
        if (val > maxVal) maxVal = val;
      });
    });

    if (showCdiBenchmark && selectedTickers.length > 0) {
      const refTicker = selectedTickers[0];
      const startingPrice = dataPoints[0].prices[refTicker] || 0;
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
  const boundMargin = (maxVal - minVal) * 0.1 || 10;
  minVal = Math.max(0, minVal - boundMargin);
  maxVal = maxVal + boundMargin;

  // Mapping coordinate calculators
  const getX = (index: number) => {
    return paddingLeft + (index / (dataPoints.length - 1)) * chartWidth;
  };

  const getY = (val: number) => {
    const scale = (val - minVal) / (maxVal - minVal);
    return svgHeight - paddingBottom - scale * chartHeight;
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

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Banner / Header Row */}
      <div className="bg-black/30 border border-white/10 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
        <div className="space-y-1.5 text-center md:text-left">
          <h2 className="text-3xl font-extrabold text-white tracking-tight flex items-center justify-center md:justify-start gap-3">
            <LineChart className="w-8 h-8 text-emerald-400" />
            Painel de Desempenho (Dashboard)
          </h2>
          <p className="text-slate-300 max-w-xl text-sm leading-relaxed">
            Monitore a valorização e a oscilação histórica dos ativos da sua carteira em tempo real. Alterne visualizações individuais ou a performance consolidada total de seu investimento.
          </p>
        </div>

        {/* Period identifier */}
        <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-400/20 px-4.5 py-2.5 rounded-2xl shadow-inner">
          <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="text-xs font-bold text-indigo-300">Acumulado No Ano (desde Jan/2026)</span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
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
              <span className="text-[11px] text-slate-300 font-medium font-mono">
                {isPositiveGrowth ? 'Alta' : 'Baixa'}
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
                    fontSize="10" 
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
                    fontSize="10" 
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
                    const price = pt.prices[asset.ticker] || 0;
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
                        const price = pt.prices[asset.ticker] || 0;
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
                  const startingPrice = dataPoints[0].prices[refTicker] || 0;
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
                    const price = dataPoints[hoveredIdx].prices[asset.ticker] || 0;
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
                <th className="pb-3 text-right">Preço Inicial</th>
                <th className="pb-3 text-right">Preço Atual</th>
                <th className="pb-3 text-right pr-2">Var. Estimada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {walletAssets.map((asset) => {
                const initialPrice = dataPoints[0].prices[asset.ticker] || asset.price;
                const currentPrice = dataPoints[dataPoints.length - 1].prices[asset.ticker] || asset.price;
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
                            ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
                            : 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                      }`}>
                        {asset.type === 'stocks' ? 'Ação BR' : asset.type === 'fii' ? 'FII' : 'S&P 500'}
                      </span>
                    </td>
                    <td className="py-3.5 text-center font-bold text-slate-300 font-mono">{weight}%</td>
                    <td className="py-3.5 text-right font-mono text-xs">
                      {asset.currency === 'USD' ? 'US$' : 'R$'} {initialPrice.toFixed(2)}
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
      
    </div>
  );
}
