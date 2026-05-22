import { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import { User } from 'firebase/auth';
import { LogIn, FileSpreadsheet, Search, Loader2, Settings, ArrowLeft, Briefcase, Wallet, LayoutDashboard } from 'lucide-react';
import { googleSignIn, initAuth, logout } from './lib/auth';
import { searchStocksFilterSheet } from './lib/drive';
import { getSpreadsheetData, getSpreadsheetSheets } from './lib/sheets';
import { WalletView } from './components/WalletView';
import { DashboardView } from './components/DashboardView';

export default function App() {
  const [needsAuth, setNeedsAuth] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);

  const [files, setFiles] = useState<{ id: string; name: string }[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string>(() => {
    return localStorage.getItem('saved_spreadsheet_id') || '';
  });

  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'analysis' | 'wallet' | 'dashboard' | 'settings'>('analysis');

  // Separated states for Stocks, FII and S&P 500
  const [analysisType, setAnalysisType] = useState<'stocks' | 'fii' | 'sp500'>('stocks');

  const [stocksAnalysisResult, setStocksAnalysisResult] = useState<string | null>(() => {
    return localStorage.getItem('stocks_analysis_result') || null;
  });
  const [stocksPreviousResult, setStocksPreviousResult] = useState<string | null>(() => {
    return localStorage.getItem('stocks_previous_result') || null;
  });
  const [stocksHighlightedResult, setStocksHighlightedResult] = useState<string | null>(() => {
    return localStorage.getItem('stocks_highlighted_result') || null;
  });

  const [fiiAnalysisResult, setFiiAnalysisResult] = useState<string | null>(() => {
    return localStorage.getItem('fii_analysis_result') || null;
  });
  const [fiiPreviousResult, setFiiPreviousResult] = useState<string | null>(() => {
    return localStorage.getItem('fii_previous_result') || null;
  });
  const [fiiHighlightedResult, setFiiHighlightedResult] = useState<string | null>(() => {
    return localStorage.getItem('fii_highlighted_result') || null;
  });

  const [sp500AnalysisResult, setSp500AnalysisResult] = useState<string | null>(() => {
    return localStorage.getItem('sp500_analysis_result') || null;
  });
  const [sp500PreviousResult, setSp500PreviousResult] = useState<string | null>(() => {
    return localStorage.getItem('sp500_previous_result') || null;
  });
  const [sp500HighlightedResult, setSp500HighlightedResult] = useState<string | null>(() => {
    return localStorage.getItem('sp500_highlighted_result') || null;
  });

  const [selectedSheetName, setSelectedSheetName] = useState<string>(() => {
    return localStorage.getItem('saved_sheet_name') || '';
  });

  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [loadingSheets, setLoadingSheets] = useState(false);

  useEffect(() => {
    if (selectedFileId) {
      localStorage.setItem('saved_spreadsheet_id', selectedFileId);
    }
  }, [selectedFileId]);

  useEffect(() => {
    if (selectedSheetName) {
      localStorage.setItem('saved_sheet_name', selectedSheetName);
    } else {
      localStorage.removeItem('saved_sheet_name');
    }
  }, [selectedSheetName]);

  // Auto-switch sheet suggestion when analysisType changes
  useEffect(() => {
    if (sheetNames.length > 0) {
      const isFiiMode = analysisType === 'fii';
      const isSp500Mode = analysisType === 'sp500';
      
      const matchedName = sheetNames.find(n => {
        const lowerName = n.toLowerCase();
        if (isFiiMode) return lowerName.includes('fii');
        if (isSp500Mode) return lowerName.includes('s&p') || lowerName.includes('sp500') || lowerName.includes('sp 500') || lowerName.includes('usa') || lowerName.includes('us');
        return lowerName.includes('ações') || lowerName.includes('açao') || lowerName.includes('acao') || lowerName.includes('stock');
      });
      
      if (matchedName) {
        setSelectedSheetName(matchedName);
      }
    }
  }, [analysisType, sheetNames]);

  useEffect(() => {
    const fetchSheets = async () => {
      if (!token || !selectedFileId) {
        setSheetNames([]);
        return;
      }
      setLoadingSheets(true);
      try {
        let actualId = selectedFileId;
        const match = selectedFileId.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (match && match[1]) {
          actualId = match[1];
        }
        const names = await getSpreadsheetSheets(token, actualId);
        setSheetNames(names);
        
        if (names.length > 0) {
          const savedSheet = localStorage.getItem('saved_sheet_name');
          if (savedSheet && names.includes(savedSheet)) {
            setSelectedSheetName(savedSheet);
          } else {
            const isFiiMode = analysisType === 'fii';
            const isSp500Mode = analysisType === 'sp500';
            const matchedName = names.find(n => {
              const lowerName = n.toLowerCase();
              if (isFiiMode) return lowerName.includes('fii');
              if (isSp500Mode) return lowerName.includes('s&p') || lowerName.includes('sp500') || lowerName.includes('sp 500') || lowerName.includes('usa') || lowerName.includes('us');
              return lowerName.includes('ações') || lowerName.includes('açao') || lowerName.includes('acao') || lowerName.includes('stock');
            });
            setSelectedSheetName(matchedName || names[0]);
          }
        } else {
          setSelectedSheetName('');
        }
      } catch (err: any) {
        console.error("Failed to load sheet list:", err);
        setSheetNames([]);
      } finally {
        setLoadingSheets(false);
      }
    };

    fetchSheets();
  }, [selectedFileId, token]);

  useEffect(() => {
    // Redirect HTTP to HTTPS for secure cookie, authentication APIs, and POST persistence on mobile
    if (typeof window !== 'undefined' && window.location.protocol === 'http:' && !window.location.hostname.includes('localhost')) {
      window.location.href = window.location.href.replace('http:', 'https:');
      return;
    }

    if (typeof window !== 'undefined') {
      setIsInIframe(window.self !== window.top);
    }

    initAuth(
      (user, token) => {
        setNeedsAuth(false);
        setUser(user);
        setToken(token);
      },
      () => setNeedsAuth(true)
    );
  }, []);

  const handleLogin = async (method: 'popup' | 'redirect' = 'popup') => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn(method);
      if (result) {
        setToken(result.accessToken);
        setUser(result.user);
        setNeedsAuth(false);
      }
    } catch (err) {
      console.error('Login failed:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setNeedsAuth(true);
    setFiles([]);
    
    setStocksAnalysisResult(null);
    setStocksPreviousResult(null);
    setStocksHighlightedResult(null);
    setFiiAnalysisResult(null);
    setFiiPreviousResult(null);
    setFiiHighlightedResult(null);
    setSelectedSheetName('');

    localStorage.removeItem('saved_spreadsheet_id');
    localStorage.removeItem('stocks_analysis_result');
    localStorage.removeItem('stocks_previous_result');
    localStorage.removeItem('stocks_highlighted_result');
    localStorage.removeItem('fii_analysis_result');
    localStorage.removeItem('fii_previous_result');
    localStorage.removeItem('fii_highlighted_result');
    localStorage.removeItem('saved_sheet_name');
  };

  const findSpreadsheets = async () => {
    if (!token) return;
    setLoadingFiles(true);
    setError(null);
    try {
      const found = await searchStocksFilterSheet(token);
      setFiles(found);
      if (found.length > 0) {
        const savedId = localStorage.getItem('saved_spreadsheet_id') || selectedFileId;
        const exists = found.some(f => f.id === savedId);
        if (savedId && exists) {
          setSelectedFileId(savedId);
        } else {
          setSelectedFileId(found[0].id);
        }
      } else {
        setError("Não foi encontrada nenhuma planilha no seu Google Drive que condiga com a busca. Você pode colar a ID diretamente.");
      }
    } catch (err: any) {
      if (err.message.includes("insufficient authentication scopes") || err.message.includes("Insufficient Permission")) {
        setError("Erro de permissão: Você esqueceu de marcar as caixinhas de permissão do Google Drive/Sheets no login. Clique em 'Sair' lá no topo e faça login novamente, marcando todas as caixinhas.");
      } else if (err.message.includes("401") || err.message.toLowerCase().includes("unauthenticated") || err.message.toLowerCase().includes("invalid authentication") || err.message.toLowerCase().includes("invalid credentials")) {
        handleLogout();
        setError("Sua sessão do Google expirou. Desconectamos sua conta, por favor faça login novamente.");
      } else {
        setError("Erro ao buscar arquivos no Drive: " + err.message);
      }
    } finally {
      setLoadingFiles(false);
    }
  };

  const analyzeSelected = async () => {
    if (!token || !selectedFileId) return;
    setAnalyzing(true);
    setError(null);

    const isFiiMode = analysisType === 'fii';
    const isSp500Mode = analysisType === 'sp500';
    const activeSheetName = selectedSheetName;
    const currentRes = isFiiMode 
      ? fiiAnalysisResult 
      : isSp500Mode 
        ? sp500AnalysisResult 
        : stocksAnalysisResult;

    try {
      // Extrair ID se o usuário colar a URL completa
      let actualId = selectedFileId;
      const match = selectedFileId.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        actualId = match[1];
      }

      // Ensure we hit HTTPS directly to avoid HTTP -> HTTPS redirects which convert POST to GET on mobile browsers.
      let apiUrl = `/api/process-data`;
      if (typeof window !== 'undefined' && window.location.protocol === 'http:' && !window.location.hostname.includes('localhost')) {
        apiUrl = `https://${window.location.host}/api/process-data`;
      }

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          token, 
          spreadsheetId: actualId, 
          sheetName: activeSheetName, 
          analysisType 
        }),
      });
      
      let data;
      if (res.headers.get("content-type")?.includes("application/json")) {
        data = await res.json();
      } else {
        const errText = await res.text();
        throw new Error(`Erro do Servidor (Status ${res.status}): ${errText.substring(0, 150)}`);
      }
      
      if (!res.ok) {
        throw new Error(data?.error || "Failed to analyze");
      }
      
      const newResult = data.result;
      
      if (isFiiMode) {
        if (currentRes && currentRes !== newResult) {
          setFiiPreviousResult(currentRes);
          localStorage.setItem('fii_previous_result', currentRes);
          const diffed = diffMarkdown(currentRes, newResult);
          setFiiHighlightedResult(diffed);
          localStorage.setItem('fii_highlighted_result', diffed);
        } else {
          setFiiPreviousResult(null);
          localStorage.removeItem('fii_previous_result');
          setFiiHighlightedResult(null);
          localStorage.removeItem('fii_highlighted_result');
        }
        setFiiAnalysisResult(newResult);
        localStorage.setItem('fii_analysis_result', newResult);
      } else if (isSp500Mode) {
        if (currentRes && currentRes !== newResult) {
          setSp500PreviousResult(currentRes);
          localStorage.setItem('sp500_previous_result', currentRes);
          const diffed = diffMarkdown(currentRes, newResult);
          setSp500HighlightedResult(diffed);
          localStorage.setItem('sp500_highlighted_result', diffed);
        } else {
          setSp500PreviousResult(null);
          localStorage.removeItem('sp500_previous_result');
          setSp500HighlightedResult(null);
          localStorage.removeItem('sp500_highlighted_result');
        }
        setSp500AnalysisResult(newResult);
        localStorage.setItem('sp500_analysis_result', newResult);
      } else {
        if (currentRes && currentRes !== newResult) {
          setStocksPreviousResult(currentRes);
          localStorage.setItem('stocks_previous_result', currentRes);
          const diffed = diffMarkdown(currentRes, newResult);
          setStocksHighlightedResult(diffed);
          localStorage.setItem('stocks_highlighted_result', diffed);
        } else {
          setStocksPreviousResult(null);
          localStorage.removeItem('stocks_previous_result');
          setStocksHighlightedResult(null);
          localStorage.removeItem('stocks_highlighted_result');
        }
        setStocksAnalysisResult(newResult);
        localStorage.setItem('stocks_analysis_result', newResult);
      }
    } catch (err: any) {
      if (err.message.includes("insufficient authentication scopes") || err.message.includes("Insufficient Permission")) {
        setError("Erro de permissão: O Google bloqueou o acesso. Clique em 'Sair' ali em cima e faça login novamente. Na tela do Google, role para baixo e MARQUE as caixinhas de permissão do Google Drive e Sheets.");
      } else if (err.message.includes("429") || err.message.includes("quota") || err.message.includes("RESOURCE_EXHAUSTED")) {
        setError("Erro de Cota do Gemini AI: O limite de tokens da chave de API foi excedido (a planilha pode ser muito grande). Tente fechar e abrir um pouco mais tarde ou verifique os limites de faturamento da sua chave da API do Gemini.");
      } else if (err.message.includes("401") || err.message.toLowerCase().includes("unauthenticated") || err.message.toLowerCase().includes("invalid authentication") || err.message.toLowerCase().includes("invalid credentials")) {
        handleLogout();
        setError("Sua sessão do Google expirou. Desconectamos sua conta, por favor faça login novamente.");
      } else if (err.message.toLowerCase().includes("load failed") || err.message.toLowerCase().includes("failed to fetch")) {
        setError(
          "O navegador do celular (especialmente o Safari no iPhone) às vezes interrompe conexões de longa duração por motivos de economia de bateria ou segurança (Load Failed). " +
          "Dicas para resolver agora: \n" +
          "1. Desative o 'Modo de Pouca Energia' nas configurações de bateria do seu celular.\n" +
          "2. Atualize a página e tente de novo com internet estável.\n" +
          "3. Abra o app usando o navegador Google Chrome no celular ou através de um computador para maior estabilidade!"
        );
      } else {
        setError("Erro ao analisar a planilha: " + err.message);
      }
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[url('/Azul1.png')] bg-cover bg-center bg-fixed text-slate-100 font-sans p-6 md:p-12 selection:bg-indigo-500/30">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-3xl -z-10"></div>
      <div className="max-w-4xl mx-auto space-y-8 relative z-10">
        
        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/10 border border-white/20 rounded-xl overflow-hidden backdrop-blur-md shadow-lg flex items-center justify-center">
              <img src="/Azul1.png" alt="Stocks Analyzer Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div>
              <h1 className="text-2xl tracking-tight text-white drop-shadow-sm"><strong className="font-bold">Stocks</strong> <span className="font-normal italic">Analyzer</span></h1>
              <p className="text-slate-300 text-sm">IA Financeira Integrada ao Google Sheets</p>
            </div>
          </div>
          {user && (
            <button 
              onClick={() => setCurrentView(currentView === 'analysis' ? 'settings' : 'analysis')} 
              className="p-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white backdrop-blur-md shadow-lg transition flex items-center gap-2"
            >
              {currentView === 'analysis' ? (
                <>
                  <Settings className="w-5 h-5" />
                </>
              ) : (
                <>
                  <ArrowLeft className="w-5 h-5" />
                  <span className="hidden sm:inline text-sm font-medium">Voltar</span>
                </>
              )}
            </button>
          )}
        </header>

        <main className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 relative">
          
          {error && (
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-11/12 max-w-2xl z-50">
              <div className="p-4 bg-red-950/80 text-red-200 rounded-xl text-sm font-medium border border-red-500/50 backdrop-blur-md shadow-2xl text-center">
                {error}
              </div>
            </div>
          )}

          {/* Menu de Páginas Primário (Análise vs Carteira) */}
          {!needsAuth && currentView !== 'settings' && (
            <div className="flex border-b border-white/10 pb-5 mb-8 gap-1 sm:gap-6 justify-center flex-wrap">
              <button
                type="button"
                onClick={() => setCurrentView('analysis')}
                className={`pb-2 px-3 sm:px-4 text-sm sm:text-base font-bold transition-all relative flex items-center gap-2 cursor-pointer ${
                  currentView === 'analysis'
                    ? 'text-white border-b-2 border-indigo-400 font-extrabold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 sm:w-5 h-5 text-indigo-400" />
                Análise de Planilhas
              </button>
              
              <button
                type="button"
                onClick={() => setCurrentView('wallet')}
                className={`pb-2 px-3 sm:px-4 text-sm sm:text-base font-bold transition-all relative flex items-center gap-2 cursor-pointer ${
                  currentView === 'wallet'
                    ? 'text-white border-b-2 border-indigo-400 font-extrabold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Wallet className="w-4 h-4 sm:w-5 h-5 text-indigo-400" />
                Minha Carteira (Wallet)
              </button>

              <button
                type="button"
                onClick={() => setCurrentView('dashboard')}
                className={`pb-2 px-3 sm:px-4 text-sm sm:text-base font-bold transition-all relative flex items-center gap-2 cursor-pointer ${
                  currentView === 'dashboard'
                    ? 'text-white border-b-2 border-indigo-400 font-extrabold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 sm:w-5 h-5 text-indigo-400" />
                Dashboard
              </button>
            </div>
          )}
          
          {needsAuth ? (
            <div className="text-center py-12 space-y-6 max-w-xl mx-auto">
              <div className="mx-auto w-16 h-16 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 shadow-inner">
                <LogIn className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-2 text-white">Conecte sua conta do Google</h2>
                <p className="text-slate-300 text-sm leading-relaxed max-w-md mx-auto">
                  Para podermos analisar suas planilhas de ativos e sincronizar sua carteira de investimentos, precisamos de permissão para ler arquivos do Google Drive e Google Sheets.
                </p>
              </div>

              {/* Informative block for mobile/iframe login issues */}
              {isInIframe ? (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-2xl p-5 text-xs text-left leading-relaxed space-y-3.5 shadow-lg">
                  <p className="font-extrabold flex items-center gap-2 text-amber-400 text-sm">
                    ⚠️ Atenção: Limitação de Celular (Iframe)
                  </p>
                  <p>
                    Você está visualizando o aplicativo dentro do painel do AI Studio. Por motivos de segurança e privacidade, navegadores móveis (Safari, Chrome) <strong>impedem qualquer fluxo de login do Google dentro de frames (painéis internos)</strong>, gerando telas brancas ou erros.
                  </p>
                  <p className="text-slate-300 font-bold">
                    Como resolver? Abra o app em aba dedicada fora do painel de desenvolvimento:
                  </p>
                  <button
                    type="button"
                    onClick={() => window.open(window.location.href, '_blank')}
                    className="w-full mt-2 py-3 px-4 bg-amber-500 text-black hover:bg-amber-400 transition font-black rounded-xl text-center active:scale-95 block cursor-pointer text-sm shadow-md"
                  >
                    Abrir no Navegador Externo (Clique Aqui) ↗
                  </button>
                </div>
              ) : (
                <div className="bg-slate-900/60 border border-white/5 text-slate-300 rounded-2xl p-5 text-xs text-left leading-relaxed space-y-3.5 shadow-lg">
                  <p className="font-bold flex items-center gap-2 text-white text-sm border-b border-white/10 pb-2">
                    📱 Dica essencial para Celular (WhatsApp / Webviews)
                  </p>
                  <ul className="list-disc pl-4 space-y-1.5 text-slate-400">
                    <li>
                      Se você abriu este link <strong>visto do WhatsApp, Instagram ou Telegram</strong>, o navegador integrado de bate-papo desses apps bloqueia logins do Google por segurança (<span className="text-amber-400 font-bold font-mono">disallowed_useragent</span>).
                    </li>
                    <li>
                      <strong>Solução:</strong> Toque no ícone de opções (geralmente nos três pontinhos <code className="bg-slate-800 px-1 py-0.5 rounded text-white font-mono">...</code> ou no ícone da bússola) e escolha <strong>&quot;Abrir no Chrome&quot;</strong> ou <strong>&quot;Abrir no Safari&quot;</strong>.
                    </li>
                  </ul>
                </div>
              )}

              {/* Login Methods for best reliability */}
              <div className="space-y-4 pt-2">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Escolha a forma de conexão no celular:</p>
                
                <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-sm mx-auto">
                  {/* POPUP METHOD - highly recommended for safari mobile tabs */}
                  <button 
                    onClick={() => handleLogin('popup')}
                    disabled={isLoggingIn}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs rounded-xl transition shadow-md border border-indigo-400/20 cursor-pointer disabled:opacity-50"
                  >
                    {isLoggingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4 shrink-0">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                        <path fill="none" d="M0 0h48v48H0z"></path>
                      </svg>
                    )}
                    <span>Entrar (Nova Caixa)</span>
                  </button>

                  {/* REDIRECT METHOD - alternative fallback */}
                  <button 
                    onClick={() => handleLogin('redirect')}
                    disabled={isLoggingIn}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 bg-black/40 hover:bg-slate-800 text-slate-200 hover:text-white font-bold text-xs rounded-xl transition shadow border border-white/10 cursor-pointer disabled:opacity-50"
                  >
                    {isLoggingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full shrink-0"></span>
                    )}
                    <span>Entrar (Redirecionar)</span>
                  </button>
                </div>
              </div>
            </div>
          ) : currentView === 'settings' ? (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              <div>
                <h2 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
                  <span className="w-1.5 h-6 bg-indigo-500 rounded-full inline-block"></span>
                  Sua Conta
                </h2>
                <div className="bg-black/30 backdrop-blur-md rounded-2xl p-6 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
                  <div className="text-center sm:text-left">
                    <p className="text-sm text-slate-400 mb-1">Logado como</p>
                    <p className="font-medium text-white">{user?.email}</p>
                  </div>
                  <button onClick={handleLogout} className="px-5 py-2.5 bg-red-500/10 text-red-300 hover:bg-red-500/20 border border-red-500/30 rounded-xl transition font-semibold w-full sm:w-auto">
                    Sair da Conta
                  </button>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
                  <span className="w-1.5 h-6 bg-indigo-500 rounded-full inline-block"></span>
                  Configurar Planilha de Dados
                </h2>
                <div className="bg-black/30 backdrop-blur-md rounded-2xl p-6 border border-white/10 space-y-6 shadow-lg">
                  
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-slate-300">Buscar automaticamente no Drive</label>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <button 
                        onClick={findSpreadsheets}
                        disabled={loadingFiles}
                        className="px-5 py-3 bg-indigo-500/80 backdrop-blur-sm text-white rounded-xl font-medium hover:bg-indigo-600/80 border border-indigo-400/30 transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg whitespace-nowrap"
                      >
                        {loadingFiles && <Loader2 className="w-4 h-4 animate-spin" />}
                        Buscar no Drive
                      </button>

                      {files.length > 0 && (
                        <select 
                            value={selectedFileId} 
                            onChange={e => setSelectedFileId(e.target.value)}
                            className="p-3 border border-white/20 rounded-xl flex-1 bg-black/40 text-white outline-none focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-400 transition min-w-0"
                          >
                          {files.map(f => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-slate-400 text-sm font-medium opacity-50">
                    <hr className="flex-1 border-white/20" />
                    ou
                    <hr className="flex-1 border-white/20" />
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-medium text-slate-300">Cole o link completo ou o ID da planilha</label>
                    <input 
                      type="text"
                      placeholder="Ex: 1BxiMvs0XRYFgwnAKB..."
                      value={selectedFileId}
                      onChange={e => setSelectedFileId(e.target.value)}
                      className="w-full p-3 border border-white/20 rounded-xl bg-black/40 text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-400 transition font-mono text-sm"
                    />
                  </div>

                  <div className="flex items-center gap-4 text-slate-400 text-sm font-medium opacity-50">
                    <hr className="flex-1 border-white/20" />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-bold text-slate-300">Aba</label>
                      {loadingSheets && (
                        <span className="text-xs text-indigo-400 flex items-center gap-1">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando abas...
                        </span>
                      )}
                    </div>

                    {sheetNames.length > 0 ? (
                      <select 
                        value={selectedSheetName} 
                        onChange={e => setSelectedSheetName(e.target.value)}
                        className="w-full p-3 border border-white/10 rounded-xl bg-black/40 text-white outline-none focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-400 transition"
                      >
                        {sheetNames.map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="p-3 border border-white/10 rounded-xl bg-black/20 text-slate-400 text-xs italic">
                        {selectedFileId ? "Nenhuma aba carregada..." : "Selecione uma planilha acima."}
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </div>
          ) : currentView === 'wallet' ? (
            <WalletView />
          ) : currentView === 'dashboard' ? (
            <DashboardView />
          ) : (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* Seletor de Abas / Visualização */}
              <div className="flex justify-center">
                <div className="inline-flex p-1 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 shadow-inner flex-wrap justify-center gap-1 sm:gap-0">
                  <button
                    type="button"
                    onClick={() => setAnalysisType('stocks')}
                    className={`px-4 sm:px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${
                      analysisType === 'stocks'
                        ? 'bg-gradient-to-r from-indigo-500/80 to-purple-600/80 text-white shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    Ações (Stocks)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnalysisType('fii')}
                    className={`px-4 sm:px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${
                      analysisType === 'fii'
                        ? 'bg-gradient-to-r from-indigo-500/80 to-purple-600/80 text-white shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    FIIs (Fundos Imobiliários)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnalysisType('sp500')}
                    className={`px-4 sm:px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${
                      analysisType === 'sp500'
                        ? 'bg-gradient-to-r from-indigo-500/80 to-purple-600/80 text-white shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    S&P 500
                  </button>
                </div>
              </div>

              {!selectedFileId ? (
                <div className="text-center py-16 space-y-4">
                  <div className="mx-auto w-20 h-20 bg-white/5 rounded-full flex items-center justify-center border border-white/10 mb-6 shadow-inner">
                    <FileSpreadsheet className="w-10 h-10 text-indigo-400/50" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">Nenhuma planilha configurada</h2>
                  <p className="text-slate-400 max-w-sm mx-auto">
                    Para usar o assistente, vá nas Configurações e selecione a planilha de dados do seu Google Drive.
                  </p>
                  <button 
                    onClick={() => setCurrentView('settings')}
                    className="mt-6 px-8 py-3 bg-indigo-500/80 backdrop-blur-sm text-white rounded-xl font-medium hover:bg-indigo-600/80 border border-indigo-400/30 transition shadow-lg inline-flex items-center gap-2"
                  >
                    <Settings className="w-5 h-5"/> Abrir Configurações
                  </button>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-white tracking-tight uppercase tracking-wider font-sans">
                      {analysisType === 'stocks' 
                        ? "Top 10 the best Stocks" 
                        : analysisType === 'sp500'
                          ? "Top 10 the best S&P 500"
                          : "Top 10 the best FII's"}
                    </h2>
                    
                    <div className="mt-3">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/5 text-indigo-200 border border-white/10">
                        Aba ativa: <span className="text-white font-mono font-bold">{selectedSheetName || "Não configurada"}</span>
                      </span>
                    </div>
                  </div>

                  <button 
                    onClick={analyzeSelected}
                    disabled={analyzing}
                    className="w-full p-5 bg-gradient-to-r from-indigo-500/80 to-purple-600/80 hover:from-indigo-500 hover:to-purple-500 border border-white/20 backdrop-blur-md text-white rounded-2xl font-bold text-lg transition flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-indigo-500/25"
                  >
                    {analyzing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Search className="w-6 h-6" />}
                    {analyzing 
                      ? 'Analisando via IA (Isso pode levar alguns segundos)...' 
                      : (analysisType === 'stocks' 
                          ? stocksAnalysisResult 
                          : analysisType === 'sp500' 
                            ? sp500AnalysisResult 
                            : fiiAnalysisResult) 
                        ? 'Analisar Novamente' 
                        : 'Ler Planilha e Gerar Ranking'}
                  </button>
                </div>
              )}
              
              {(analysisType === 'stocks' 
                ? stocksAnalysisResult 
                : analysisType === 'sp500' 
                  ? sp500AnalysisResult 
                  : fiiAnalysisResult) && (
                <div className="pt-10 border-t border-white/10 mt-10 relative">
                  <h3 className="text-2xl font-bold mb-8 text-white flex items-center gap-3">
                    <span className="w-1.5 h-8 bg-gradient-to-b from-indigo-400 to-purple-500 rounded-full inline-block"></span>
                    Relatório Especializado - {analysisType === 'stocks' 
                      ? 'Ações' 
                      : analysisType === 'sp500' 
                        ? 'S&P 500' 
                        : 'Fundos Imobiliários'}
                  </h3>

                  {(analysisType === 'stocks' 
                    ? stocksHighlightedResult 
                    : analysisType === 'sp500' 
                      ? sp500HighlightedResult 
                      : fiiHighlightedResult) && (
                    <div className="flex items-center justify-between mb-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3 text-sm text-yellow-300 backdrop-blur-md">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse inline-block"></span>
                        Alterações desde a leitura anterior destacadas em amarelo
                      </span>
                      <button 
                        onClick={() => {
                          if (analysisType === 'stocks') {
                            setStocksHighlightedResult(null);
                            localStorage.removeItem('stocks_highlighted_result');
                          } else if (analysisType === 'sp500') {
                            setSp500HighlightedResult(null);
                            localStorage.removeItem('sp500_highlighted_result');
                          } else {
                            setFiiHighlightedResult(null);
                            localStorage.removeItem('fii_highlighted_result');
                          }
                        }} 
                        className="text-yellow-400 hover:text-white underline font-semibold transition text-xs cursor-pointer"
                      >
                        Limpar destaques
                      </button>
                    </div>
                  )}

                  <div className="bg-black/30 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-10 shadow-2xl">
                    <div className="markdown-body">
                      <Markdown
                        components={{
                          code({ className, children, ...props }: any) {
                            const codeText = String(children);
                            if (!className && codeText.startsWith('h:')) {
                              return (
                                <mark className="bg-yellow-400/40 text-yellow-200 px-1 py-0.5 rounded border border-yellow-500/40 font-sans font-semibold not-italic">
                                  {codeText.slice(2)}
                                </mark>
                              );
                            }
                            return <code className={className} {...props}>{children}</code>;
                          }
                        }}
                      >
                        {(analysisType === 'stocks' 
                          ? (stocksHighlightedResult || stocksAnalysisResult) 
                          : analysisType === 'sp500' 
                            ? (sp500HighlightedResult || sp500AnalysisResult) 
                            : (fiiHighlightedResult || fiiAnalysisResult)) || ''}
                      </Markdown>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
        </main>
      </div>
    </div>
  );
}

function diffContentTokens(oldLine: string, newLine: string): string {
  const tokenRegex = /(\s+|[|*#`()\[\]]+|[^\s|*#`()\[\]]+)/g;
  
  const oldTokens = oldLine.match(tokenRegex) || [];
  const newTokens = newLine.match(tokenRegex) || [];
  
  const dp: number[][] = Array.from({ length: oldTokens.length + 1 }, () =>
    Array(newTokens.length + 1).fill(0)
  );

  for (let i = 1; i <= oldTokens.length; i++) {
    for (let j = 1; j <= newTokens.length; j++) {
      if (oldTokens[i - 1] === newTokens[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  let i = oldTokens.length;
  let j = newTokens.length;
  const result: { text: string; status: 'added' | 'unchanged' }[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldTokens[i - 1] === newTokens[j - 1]) {
      result.unshift({ text: newTokens[j - 1], status: 'unchanged' });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ text: newTokens[j - 1], status: 'added' });
      j--;
    } else {
      i--;
    }
  }

  let assembled = '';
  let currentHighlightGroup = '';

  for (const token of result) {
    const isFormattingOrWhitespace = /^[|*#`()\[\]\s]+$/.test(token.text);
    if (token.status === 'added' && !isFormattingOrWhitespace) {
      currentHighlightGroup += token.text.replace(/`/g, '');
    } else {
      if (currentHighlightGroup) {
        assembled += '`h:' + currentHighlightGroup + '`';
        currentHighlightGroup = '';
      }
      assembled += token.text;
    }
  }
  if (currentHighlightGroup) {
    assembled += '`h:' + currentHighlightGroup + '`';
  }

  return assembled;
}

function diffMarkdown(oldText: string, newText: string): string {
  if (!oldText) return newText;

  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  const dp: number[][] = Array.from({ length: oldLines.length + 1 }, () =>
    Array(newLines.length + 1).fill(0)
  );

  for (let i = 1; i <= oldLines.length; i++) {
    for (let j = 1; j <= newLines.length; j++) {
      if (oldLines[i - 1].trim() === newLines[j - 1].trim()) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  let i = oldLines.length;
  let j = newLines.length;
  
  const ops: { type: 'keep' | 'add' | 'delete'; line: string }[] = [];
  
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1].trim() === newLines[j - 1].trim()) {
      ops.unshift({ type: 'keep', line: newLines[j - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ type: 'add', line: newLines[j - 1] });
      j--;
    } else {
      ops.unshift({ type: 'delete', line: oldLines[i - 1] });
      i--;
    }
  }

  const finalLines: string[] = [];
  let blockDeletes: string[] = [];
  let blockAdds: string[] = [];

  const flushEditBlock = () => {
    const minLen = Math.min(blockDeletes.length, blockAdds.length);
    for (let k = 0; k < minLen; k++) {
      finalLines.push(diffContentTokens(blockDeletes[k], blockAdds[k]));
    }
    for (let k = minLen; k < blockAdds.length; k++) {
      finalLines.push(diffContentTokens('', blockAdds[k]));
    }
    blockDeletes = [];
    blockAdds = [];
  };

  for (const op of ops) {
    if (op.type === 'keep') {
      flushEditBlock();
      finalLines.push(op.line);
    } else if (op.type === 'delete') {
      blockDeletes.push(op.line);
    } else if (op.type === 'add') {
      blockAdds.push(op.line);
    }
  }
  flushEditBlock();

  return finalLines.join('\n');
}

