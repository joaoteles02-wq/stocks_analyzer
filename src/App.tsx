import React, { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import { User } from 'firebase/auth';
import { LogIn, FileSpreadsheet, Search, Loader2, Settings, ArrowLeft, Briefcase, Wallet, LayoutDashboard, Upload, Database, Copy, Check, AlertTriangle, RefreshCw } from 'lucide-react';
import { googleSignIn, initAuth, logout, clearCachedToken } from './lib/auth';
import { searchStocksFilterSheet } from './lib/drive';
import { getSpreadsheetData, getSpreadsheetSheets } from './lib/sheets';
import { WalletView, getStrategyPreview } from './components/WalletView';
import { DashboardView } from './components/DashboardView';
import { pullWalletConfig } from './lib/sync';

export default function App() {
  const [needsAuth, setNeedsAuth] = useState(true);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [tokenExpired, setTokenExpired] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);

  const [files, setFiles] = useState<{ id: string; name: string }[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string>(() => {
    return localStorage.getItem('saved_spreadsheet_id') || '';
  });

  const [dataSource, setDataSource] = useState<'google' | 'local'>(() => {
    return (localStorage.getItem('data_source') as 'google' | 'local') || 'google';
  });

  const [localUploadedSheetData, setLocalUploadedSheetData] = useState<any[][] | null>(() => {
    const saved = localStorage.getItem('local_uploaded_sheet_data');
    return saved ? JSON.parse(saved) : null;
  });

  const [localSourceName, setLocalSourceName] = useState<string>(() => {
    return localStorage.getItem('local_source_name') || 'Dados Importados (Local)';
  });

  const [rawPasteText, setRawPasteText] = useState('');
  const [pasteSuccess, setPasteSuccess] = useState(false);

  useEffect(() => {
    pullWalletConfig().then((synced) => {
      if (synced) {
        localStorage.setItem('data_source', dataSource);
        window.location.reload();
      }
    });
  }, []);

  useEffect(() => {
    localStorage.setItem('data_source', dataSource);
  }, [dataSource]);

  useEffect(() => {
    if (localUploadedSheetData) {
      localStorage.setItem('local_uploaded_sheet_data', JSON.stringify(localUploadedSheetData));
    } else {
      localStorage.removeItem('local_uploaded_sheet_data');
    }
  }, [localUploadedSheetData]);

  useEffect(() => {
    localStorage.setItem('local_source_name', localSourceName);
  }, [localSourceName]);

  const handleLocalDataParse = (text: string, name: string) => {
    if (!text.trim()) {
      setError("O conteúdo colado ou arquivo está vazio.");
      return;
    }

    try {
      // Split lines and filter empty lines
      const tempLines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line !== '');
      if (tempLines.length === 0) {
        throw new Error("Nenhuma linha identificada.");
      }

      // Identify delimiter: tab, semicolon, comma
      const parsedRows = tempLines.map((line) => {
        let delimiter = ',';
        if (line.includes('\t')) {
          delimiter = '\t';
        } else if (line.includes(';')) {
          delimiter = ';';
        }

        // Easy and fast custom parse with quotes support
        const columns: string[] = [];
        let current = '';
        let insideQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            insideQuotes = !insideQuotes;
          } else if (char === delimiter && !insideQuotes) {
            columns.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        columns.push(current.trim());
        return columns.map(c => {
          if (c.startsWith('"') && c.endsWith('"')) {
            return c.slice(1, -1).trim();
          }
          return c;
        });
      });

      setLocalUploadedSheetData(parsedRows);
      setLocalSourceName(name || 'Planilha Colada');
      setPasteSuccess(true);
      setTimeout(() => setPasteSuccess(false), 3500);
      setError(null);
    } catch (err: any) {
      setError("Erro ao processar dados copiados/importados: " + err.message);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      handleLocalDataParse(text, file.name);
    };
    reader.readAsText(file);
  };

  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [analysisVersion, setAnalysisVersion] = useState(0);
  const [currentView, setCurrentView] = useState<'analysis' | 'wallet' | 'dashboard' | 'settings'>(() => {
    const saved = localStorage.getItem('app_current_view');
    if (saved === 'wallet' || saved === 'dashboard' || saved === 'settings') return saved;
    return 'analysis';
  });

  useEffect(() => {
    localStorage.setItem('app_current_view', currentView);
  }, [currentView]);

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
        const errMsg = err.message || '';
        if (errMsg.includes("insufficient authentication scopes") || errMsg.includes("Insufficient Permission")) {
          setError("Erro de permissão: Você esqueceu de marcar as caixinhas de permissão para ler arquivos do Google Drive e Sheets ao fazer login. Clique em 'Sair' lá no topo e faça login novamente marcando todas as permissões.");
        } else if (errMsg.includes("401") || errMsg.toLowerCase().includes("unauthenticated") || errMsg.toLowerCase().includes("invalid authentication") || errMsg.toLowerCase().includes("invalid credentials")) {
          handleTokenInvalidation(errMsg);
          setError("Sua sessão de conexão do Google Planilhas expirou por segurança. Use o botão amarelo de reconexão 'Reconectar Google Drive' acima.");
        } else {
          setError(`Erro ao carregar lista de abas: ${errMsg}`);
        }
      } finally {
        setLoadingSheets(false);
      }
    };

    fetchSheets();
  }, [selectedFileId, token]);

  // Synchronize Google Sheet raw values to local state for local calculations on Dashboard/Wallet
  useEffect(() => {
    const fetchRawData = async () => {
      if (dataSource === 'google' && token && selectedFileId && selectedSheetName) {
        try {
          let actualId = selectedFileId;
          const match = selectedFileId.match(/\/d\/([a-zA-Z0-9-_]+)/);
          if (match && match[1]) {
            actualId = match[1];
          }
          const fetched = await getSpreadsheetData(token, actualId, selectedSheetName);
          if (fetched && fetched.length > 0) {
            setLocalUploadedSheetData(fetched);
          }
        } catch (e: any) {
          console.error("Auto fetch Google Sheet raw values failed:", e);
          const errMsg = e.message || '';
          if (errMsg.includes("401") || errMsg.toLowerCase().includes("unauthenticated") || errMsg.toLowerCase().includes("invalid authentication") || errMsg.toLowerCase().includes("invalid credentials")) {
            handleTokenInvalidation(errMsg);
          }
        }
      }
    };
    fetchRawData();
  }, [dataSource, token, selectedFileId, selectedSheetName]);

  useEffect(() => {
    // Redirect HTTP to HTTPS for secure cookie, authentication APIs, and POST persistence on mobile
    // Skip redirect for localhost and local network IP addresses (e.g., 192.168.x.x, 10.x.x.x, 172.x.x.x)
    const isLocalHostname = typeof window !== 'undefined' && (
      window.location.hostname.includes('localhost') ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.startsWith('192.168.') ||
      window.location.hostname.startsWith('10.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(window.location.hostname)
    );

    if (typeof window !== 'undefined' && window.location.protocol === 'http:' && !isLocalHostname) {
      window.location.href = window.location.href.replace('http:', 'https:');
      return;
    }

    if (typeof window !== 'undefined') {
      try {
        setIsInIframe(window.self !== window.top);
      } catch (e) {
        setIsInIframe(true);
      }
    }

    let authInitCount = 0;
    initAuth(
      (user, token) => {
        setNeedsAuth(false);
        setUser(user);
        setToken(token);
      },
      () => {
        if (authInitCount > 0) setNeedsAuth(true);
      },
      () => {
        authInitCount++;
        setAuthInitialized(true);
      }
    );
  }, []);

  const handleTokenInvalidation = (reason: string) => {
    console.warn("Invalid or expired Google OAuth token detected:", reason);
    clearCachedToken();
    setToken(null);
    setTokenExpired(true);
  };

  const handleLogin = async (method: 'popup' | 'redirect' = 'popup') => {
    setIsLoggingIn(true);
    setError(null);
    try {
      const result = await googleSignIn(method);
      if (result) {
        setToken(result.accessToken);
        setUser(result.user);
        setNeedsAuth(false);
        setTokenExpired(false);
      }
    } catch (err: any) {
      console.error('Login failed:', err);
      setError("Falha ao fazer login com o Google: " + (err.message || err));
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleQuickTokenRefresh = async (method: 'popup' | 'redirect' = 'popup') => {
    setIsLoggingIn(true);
    setError(null);
    
    // Safety timer: browser popup blockers often freeze the sign-in promise indefinitely.
    // We clear isLoggingIn after 15 seconds so they can retry or try another method.
    const timeoutId = setTimeout(() => {
      setIsLoggingIn(false);
      setError(
        "A tentativa de login demorou muito. Se estiver usando o celular dentro de um aplicativo " +
          "como o WhatsApp/Instagram ou painel do AI Studio, use o botão azul para 'Abrir em Nova Aba' " +
          "ou tente com o método 'Reconectar (Redirecionar)'."
      );
    }, 15000);

    try {
      const result = await googleSignIn(method);
      clearTimeout(timeoutId);
      if (result) {
        setToken(result.accessToken);
        setUser(result.user);
        setNeedsAuth(false);
        setTokenExpired(false);
        setError(null);
        // Silently reload the file tree
        try {
          const found = await searchStocksFilterSheet(result.accessToken);
          setFiles(found);
        } catch (e) {
          console.error("Failed to re-search Drive on refresh:", e);
        }
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('Quick refresh failed:', err);
      setError("Falha ao atualizar a conexão. Erro: " + (err.message || err));
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
    localStorage.removeItem('sp500_analysis_result');
    localStorage.removeItem('sp500_previous_result');
    localStorage.removeItem('sp500_highlighted_result');
    localStorage.removeItem('saved_sheet_name');
    localStorage.removeItem('pending_wallet_apply');
    localStorage.removeItem('analysis_timestamp');
    localStorage.removeItem('wallet_applied_timestamp');
    localStorage.removeItem('wallet_just_applied_analysis');
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
        handleTokenInvalidation(err.message || '');
        setError("Sua sessão de conexão do Google Planilhas expirou por segurança. Use o botão amarelo de reconexão acima.");
      } else {
        setError("Erro ao buscar arquivos no Drive: " + err.message);
      }
    } finally {
      setLoadingFiles(false);
    }
  };

  const analyzeSelected = async () => {
    const isLocalMode = dataSource === 'local';
    
    if (!isLocalMode && (!token || !selectedFileId)) {
      setError("Por favor, conecte ao Google Drive nas Configurações e selecione uma planilha.");
      return;
    }
    
    if (isLocalMode && (!localUploadedSheetData || localUploadedSheetData.length === 0)) {
      setError("Por favor, importe um arquivo CSV ou cole os dados da planilha nas Configurações.");
      return;
    }

    setAnalyzing(true);
    setError(null);
    setInfoMessage(null);

    const isFiiMode = analysisType === 'fii';
    const isSp500Mode = analysisType === 'sp500';
    const activeSheetName = isLocalMode ? localSourceName : selectedSheetName;
    const currentRes = isFiiMode 
      ? fiiAnalysisResult 
      : isSp500Mode 
        ? sp500AnalysisResult 
        : stocksAnalysisResult;

    try {
      // Extrair ID se o usuário colar a URL completa
      let actualId = selectedFileId;
      if (!isLocalMode) {
        const match = selectedFileId.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (match && match[1]) {
          actualId = match[1];
        }
      }

      // Ensure we hit HTTPS directly to avoid HTTP -> HTTPS redirects which convert POST to GET on mobile browsers.
      const isLocalhost = typeof window !== 'undefined' && window.location.hostname.includes('localhost');
      const apiHost = isLocalhost ? '' : `https://${window.location.host}`;
      
      const params = new URLSearchParams({
        token: isLocalMode ? '' : (token || ''),
        spreadsheetId: isLocalMode ? 'local' : (actualId || ''),
        sheetName: isLocalMode ? 'local' : (activeSheetName || ''),
        analysisType: analysisType || ''
      });
      const apiUrl = `${apiHost}/api/process-data?${params.toString()}`;

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Google-Token": isLocalMode ? '' : (token || ''),
          "X-Spreadsheet-Id": isLocalMode ? 'local' : (actualId || ''),
          "X-Sheet-Name": isLocalMode ? 'local' : (activeSheetName || ''),
          "X-Analysis-Type": analysisType || ''
        },
        body: JSON.stringify({ 
          token: isLocalMode ? null : token, 
          spreadsheetId: isLocalMode ? null : actualId, 
          sheetName: isLocalMode ? 'local' : activeSheetName, 
          analysisType,
          sheetData: isLocalMode ? localUploadedSheetData : undefined
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
          setInfoMessage(null);
        } else {
          setFiiPreviousResult(null);
          localStorage.removeItem('fii_previous_result');
          setFiiHighlightedResult(null);
          localStorage.removeItem('fii_highlighted_result');
          if (currentRes) {
            setInfoMessage("Nenhuma alteração detectada nos dados. O ranking permanece igual ao da última análise.");
          }
        }
        setFiiAnalysisResult(newResult);
        localStorage.setItem('fii_analysis_result', newResult);
        localStorage.setItem('latest_analysis_type', 'fii');
        localStorage.setItem('pending_wallet_apply', 'fii');
        localStorage.setItem('analysis_timestamp', String(Date.now()));
        setAnalysisVersion(v => v + 1);
      } else if (isSp500Mode) {
        if (currentRes && currentRes !== newResult) {
          setSp500PreviousResult(currentRes);
          localStorage.setItem('sp500_previous_result', currentRes);
          const diffed = diffMarkdown(currentRes, newResult);
          setSp500HighlightedResult(diffed);
          localStorage.setItem('sp500_highlighted_result', diffed);
          setInfoMessage(null);
        } else {
          setSp500PreviousResult(null);
          localStorage.removeItem('sp500_previous_result');
          setSp500HighlightedResult(null);
          localStorage.removeItem('sp500_highlighted_result');
          if (currentRes) {
            setInfoMessage("Nenhuma alteração detectada nos dados. O ranking permanece igual ao da última análise.");
          }
        }
        setSp500AnalysisResult(newResult);
        localStorage.setItem('sp500_analysis_result', newResult);
        localStorage.setItem('latest_analysis_type', 'sp500');
        localStorage.setItem('pending_wallet_apply', 'sp500');
        localStorage.setItem('analysis_timestamp', String(Date.now()));
        setAnalysisVersion(v => v + 1);
      } else {
        if (currentRes && currentRes !== newResult) {
          setStocksPreviousResult(currentRes);
          localStorage.setItem('stocks_previous_result', currentRes);
          const diffed = diffMarkdown(currentRes, newResult);
          setStocksHighlightedResult(diffed);
          localStorage.setItem('stocks_highlighted_result', diffed);
          setInfoMessage(null);
        } else {
          setStocksPreviousResult(null);
          localStorage.removeItem('stocks_previous_result');
          setStocksHighlightedResult(null);
          localStorage.removeItem('stocks_highlighted_result');
          if (currentRes) {
            setInfoMessage("Nenhuma alteração detectada nos dados. O ranking permanece igual ao da última análise.");
          }
        }
        setStocksAnalysisResult(newResult);
        localStorage.setItem('stocks_analysis_result', newResult);
        localStorage.setItem('latest_analysis_type', 'stocks');
        localStorage.setItem('pending_wallet_apply', 'stocks');
        localStorage.setItem('analysis_timestamp', String(Date.now()));
        setAnalysisVersion(v => v + 1);
      }

      // Pre-compute wallet composition immediately for reliable sync with Wallet page
      try {
        const savedStrat = localStorage.getItem('active_strategy') || 'equilibrada';
        const strategyType = savedStrat as 'renda' | 'equilibrada' | 'crescimento';
        const newSlots = getStrategyPreview(strategyType);
        if (newSlots && newSlots.length > 0) {
          localStorage.setItem('saved_interactive_wallet_full', JSON.stringify(newSlots));
          const compactSlots = newSlots.map((w: any) => ({ ticker: w.asset.ticker, weight: w.weight }));
          localStorage.setItem('saved_interactive_wallet', JSON.stringify(compactSlots));
          localStorage.setItem('wallet_applied_timestamp', String(Date.now()));
          localStorage.setItem('wallet_just_applied_analysis', 'true');
          localStorage.removeItem('pending_wallet_apply');
        }
      } catch (e) {
        console.warn('Could not pre-compute wallet composition, WalletView will apply on mount:', e);
      }
    } catch (err: any) {
      if (err.message.includes("insufficient authentication scopes") || err.message.includes("Insufficient Permission")) {
        setError("Erro de permissão: O Google bloqueou o acesso. Clique em 'Sair' ali em cima e faça login novamente. Na tela do Google, role para baixo e MARQUE as caixinhas de permissão do Google Drive e Sheets.");
      } else if (err.message.includes("429") || err.message.includes("quota") || err.message.includes("RESOURCE_EXHAUSTED")) {
        setError("Erro de Cota do Gemini AI: O limite de tokens da chave de API foi excedido (a planilha pode ser muito grande). Tente fechar e abrir um pouco mais tarde ou verifique os limites de faturamento da sua chave da API do Gemini.");
      } else if (err.message.includes("401") || err.message.toLowerCase().includes("unauthenticated") || err.message.toLowerCase().includes("invalid authentication") || err.message.toLowerCase().includes("invalid credentials")) {
        handleTokenInvalidation(err.message || '');
        setError("Sua sessão de conexão do Google Planilhas expirou. Por favor reconecte usando o botão amarelo acima para reanalisar sem perder nada.");
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
    <div className="min-h-dvh text-slate-100 font-sans p-6 md:p-12 pb-40 md:pb-40 selection:bg-indigo-500/30" style={{paddingBottom: 'max(10rem, calc(6rem + env(safe-area-inset-bottom)))' }}>
      {/* Background Image fixo de alta performance (evita bug de redimensionamento em Safari mobile) */}
      <div className="app-bg-image fixed inset-0 bg-[url('/por-do-sol.jpg')] bg-cover bg-center -z-20 pointer-events-none"></div>
      {/* Camada escura de 60% para garantir contraste do texto sem embaçar a imagem */}
      <div className="fixed inset-0 bg-slate-950/30 -z-10 pointer-events-none"></div>
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
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-block text-xs text-slate-300 font-medium bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg max-w-[200px] truncate">
                {user.email}
              </span>
            </div>
          )}
        </header>

        <main className="bg-black/30 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 relative">
          
          {tokenExpired && (
            <div className="mb-6 p-5 bg-amber-500/15 border border-amber-400/30 text-amber-200 rounded-2xl flex flex-col gap-4 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex items-start gap-3 text-sm text-left">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-extrabold text-amber-300 text-base">Sua conexão com o Google Planilhas expirou</p>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    A sessão de acesso do Google expira a cada 1 hora por segurança.
                    Reconecte rapidamente abaixo para continuar atualizando os dados dinâmicos da planilha sem perder seus filtros ou análises atuais.
                  </p>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1 border-t border-amber-500/10">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center shrink-0">
                  Métodos de Reconexão:
                </span>
                
                <div className="flex flex-wrap gap-2.5 flex-1">
                  {/* POPUP RECONNECT */}
                  <button
                    type="button"
                    onClick={() => handleQuickTokenRefresh('popup')}
                    disabled={isLoggingIn}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-extrabold text-xs rounded-xl transition active:scale-95 cursor-pointer shadow border border-amber-400/20"
                    title="Abre uma nova janela pop-up para reconectar sua conta de forma rápida."
                  >
                    {isLoggingIn ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    Reconectar (Pop-up)
                  </button>

                  {/* REDIRECT RECONNECT */}
                  <button
                    type="button"
                    onClick={() => handleQuickTokenRefresh('redirect')}
                    disabled={isLoggingIn}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-900/80 hover:bg-slate-800 disabled:opacity-50 text-slate-200 hover:text-white font-bold text-xs rounded-xl transition active:scale-95 cursor-pointer shadow border border-white/10"
                    title="Faz o login recarregando a página inteira. À prova de bloqueio de pop-ups em celulares!"
                  >
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full shrink-0"></span>
                    Reconectar (Redirecionar)
                  </button>

                  {/* IFRAME ONLY - OPEN IN NEW TAB FALLBACK */}
                  {isInIframe && (
                    <button
                      type="button"
                      onClick={() => window.open(window.location.href, '_blank')}
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition active:scale-95 cursor-pointer shadow-md border border-indigo-400/20"
                      title="Navegadores móveis e iframes bloqueiam logins do Google por segurança. Abra em aba separada externa para se conectar perfeitamente!"
                    >
                      <span className="text-xs">↗</span>
                      Abrir em Nova Aba (Recomendado)
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-11/12 max-w-2xl z-50">
              <div className="p-4 bg-red-950/80 text-red-200 rounded-xl text-sm font-medium border border-red-500/50 backdrop-blur-md shadow-2xl text-center">
                {error}
              </div>
            </div>
          )}

          {infoMessage && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 w-11/12 max-w-2xl z-50">
              <div className="p-4 bg-emerald-950/80 text-emerald-200 rounded-xl text-sm font-medium border border-emerald-500/50 backdrop-blur-md shadow-2xl text-center">
                {infoMessage}
              </div>
            </div>
          )}
          
          {!authInitialized && dataSource !== 'local' ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
              <p className="text-slate-400 text-sm">Verificando autenticação...</p>
            </div>
          ) : needsAuth && dataSource !== 'local' ? (
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
                
                <div className="flex flex-col gap-3 max-w-sm mx-auto">
                  <div className="flex flex-col sm:flex-row gap-3">
                    {/* POPUP METHOD - highly recommended for safari mobile tabs */}
                    <button 
                      type="button"
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
                      type="button"
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

                  {/* BYPASS LOGIN FOR CELLPHONE / OFFLINE / MANUAL FLOWS */}
                  <div className="pt-4 border-t border-white/10 mt-2">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2 flex items-center justify-center gap-1">
                      <span>Burlar erro do Google ou usar offline</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setDataSource('local');
                        setNeedsAuth(false);
                      }}
                      className="w-full flex items-center justify-center gap-2.5 px-5 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-extrabold text-xs rounded-xl transition shadow border border-emerald-500/20 cursor-pointer"
                    >
                      <Upload className="w-4 h-4 shrink-0 text-emerald-200" />
                      <span>Ver Aplicativo / Usar Planilha Local (Celular)</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : currentView === 'settings' ? (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* Seletor de Origem de Dados */}
              <div className="bg-black/30 backdrop-blur-md rounded-2xl p-6 border border-white/10 shadow-lg space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">Origem dos Dados das Planilhas</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setDataSource('google');
                      if (!token) {
                        setNeedsAuth(true);
                      }
                    }}
                    className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all duration-300 ${
                      dataSource === 'google'
                        ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-500/10'
                        : 'bg-black/20 border-white/5 text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    <div className="p-2.5 bg-indigo-500/20 rounded-xl text-indigo-300">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-sm">Google Drive (Online / Nuvem)</p>
                      <p className="text-xs text-slate-400 mt-1">Busca e lê diretamente as tabelas do seu Google Drive.</p>
                      {dataSource === 'google' && (
                        <span className="inline-block mt-2 text-[10px] bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-full font-bold">Ativo</span>
                      )}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDataSource('local');
                      setNeedsAuth(false);
                    }}
                    className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all duration-300 ${
                      dataSource === 'local'
                        ? 'bg-emerald-600/20 border-emerald-500 text-white shadow-lg shadow-emerald-500/10'
                        : 'bg-black/20 border-white/5 text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    <div className="p-2.5 bg-emerald-500/20 rounded-xl text-emerald-300">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-sm">Importação Direta (Celular / Offline)</p>
                      <p className="text-xs text-slate-400 mt-1">📱 Excelente para dispositivos móveis. Sem login, basta colar ou enviar o CSV.</p>
                      {dataSource === 'local' && (
                        <span className="inline-block mt-2 text-[10px] bg-emerald-500/30 text-emerald-200 px-2 py-0.5 rounded-full font-bold">Ativo</span>
                      )}
                    </div>
                  </button>
                </div>
              </div>

              {dataSource === 'google' ? (
                <>
                  <div>
                    <h2 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
                      <span className="w-1.5 h-6 bg-indigo-500 rounded-full inline-block"></span>
                      Sua Conta Google
                    </h2>
                    <div className="bg-black/30 backdrop-blur-md rounded-2xl p-6 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
                      <div className="text-center sm:text-left">
                        <p className="text-sm text-slate-400 mb-1">Logado como</p>
                        <p className="font-medium text-white">{user?.email || "Nenhum usuário conectado"}</p>
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
                            disabled={loadingFiles || !token}
                            className="px-5 py-3 bg-indigo-500/80 backdrop-blur-sm text-white rounded-xl font-medium hover:bg-indigo-600/80 border border-indigo-400/30 transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg whitespace-nowrap cursor-pointer"
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
                </>
              ) : (
                <>
                  <div>
                    <h2 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
                      <span className="w-1.5 h-6 bg-emerald-500 rounded-full inline-block"></span>
                      Planilha Local (Sem Dependência de Login)
                    </h2>
                    
                    <div className="bg-black/30 backdrop-blur-md rounded-2xl p-6 border border-white/10 space-y-6 shadow-lg">
                      <div className="bg-slate-900/50 p-4 rounded-xl text-xs text-slate-300 leading-relaxed space-y-2 border border-white/5">
                        <p className="font-bold text-white text-sm flex items-center gap-1.5">
                          💡 Por que usar este método?
                        </p>
                        <p>
                          Navegadores móveis integrados (como do WhatsApp, Instagram ou navegadores do iPhone Safari) frequentemente impedem logins do Google devido a restrições em iframe ou de cookies de terceiros.
                        </p>
                        <p>
                          <strong>Como fazer:</strong> Abra sua tabela em outro app ou aba, selecione todas as células incluindo o cabeçalho (com dados de Ticker/Ativo, EV/EBITDA, ROE, Dividend Yield, etc.), copie-as e cole abaixo! O app identificará tudo automaticamente.
                        </p>
                      </div>

                      {localUploadedSheetData && (
                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-2 text-emerald-300">
                          <p className="text-sm font-bold flex items-center gap-2">
                             <Check className="w-4 h-4 text-emerald-400" /> Planilha Carregada com Sucesso!
                          </p>
                          <ul className="text-xs list-disc pl-4 space-y-1 text-slate-300">
                            <li>Origem: <strong>{localSourceName}</strong></li>
                            <li>Registros identificados: <strong>{localUploadedSheetData.length} linhas</strong></li>
                            <li>Colunas detectadas por linha: <strong>{localUploadedSheetData[0]?.length || 0} colunas</strong></li>
                          </ul>
                          <button
                            type="button"
                            onClick={() => {
                              setLocalUploadedSheetData(null);
                              setLocalSourceName('Dados Importados (Local)');
                            }}
                            className="mt-1 px-3 py-1.5 bg-red-500/15 hover:bg-red-500/35 text-red-200 text-[11px] rounded transition font-medium cursor-pointer"
                          >
                            Limpar Dados Importados
                          </button>
                        </div>
                      )}

                      {/* File Upload Selector */}
                      <div className="space-y-3">
                        <label className="text-sm font-medium text-slate-300 block">Opção A: Enviar arquivo de Planilha (.csv)</label>
                        <div className="relative border border-dashed border-white/20 rounded-xl p-6 text-center hover:bg-white/5 transition group">
                          <input 
                            type="file" 
                            accept=".csv"
                            onChange={handleFileUpload}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                          />
                          <div className="space-y-2 flex flex-col items-center">
                            <Upload className="w-8 h-8 text-slate-400 group-hover:text-indigo-400 transition" />
                            <p className="text-sm text-slate-300 font-medium">Toque para selecionar ou arraste o arquivo CSV</p>
                            <p className="text-xs text-slate-500">Suporta arquivos separados por vírgula (,), ponto e vírgula (;) ou tabulações.</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-slate-500 text-xs font-semibold opacity-40">
                        <hr className="flex-1 border-white/20" />
                        ou
                        <hr className="flex-1 border-white/20" />
                      </div>

                      {/* Copiar e Colar TextArea */}
                      <div className="space-y-3">
                        <label className="text-sm font-medium text-slate-300 block">Opção B: Copiar & Colar células diretamente do Excel ou Google Sheets</label>
                        <textarea
                          placeholder="Cole as colunas/linhas copiadas da sua planilha aqui... (Ex: Ticker \t Dividend Yield \t ROE...)"
                          value={rawPasteText}
                          onChange={e => setRawPasteText(e.target.value)}
                          className="w-full h-32 p-3 border border-white/20 rounded-xl bg-black/40 text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-400 transition font-mono text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            handleLocalDataParse(rawPasteText, "Planilha Colada (" + new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}) + ")");
                            setRawPasteText('');
                          }}
                          disabled={!rawPasteText.trim()}
                          className="w-full py-3 bg-indigo-500/80 backdrop-blur-sm text-white rounded-xl font-bold text-sm hover:bg-indigo-600 border border-indigo-400/30 transition disabled:opacity-40 cursor-pointer text-center"
                        >
                          Processar Células Coladas
                        </button>
                      </div>

                    </div>
                  </div>
                </>
              )}
            </div>
          ) : currentView === 'wallet' ? (
            <WalletView key={`wallet-${analysisVersion}-${currentView}`} />
          ) : currentView === 'dashboard' ? (
            <ErrorBoundary key="dashboard-error-boundary">
              <DashboardView />
            </ErrorBoundary>
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

              {/* Resultado da análise — exibido sempre que existir, independente de planilha configurada */}
              {(analysisType === 'stocks' 
                ? stocksAnalysisResult 
                : analysisType === 'sp500' 
                  ? sp500AnalysisResult 
                  : fiiAnalysisResult) && (
                <div className="relative">
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

              {/* Botão de análise e seleção de planilha */}
              {((dataSource === 'google' && !selectedFileId) || (dataSource === 'local' && (!localUploadedSheetData || localUploadedSheetData.length === 0))) ? (
                <div className="text-center py-16 space-y-4">
                  <div className="mx-auto w-20 h-20 bg-white/5 rounded-full flex items-center justify-center border border-white/10 mb-6 shadow-inner">
                    <FileSpreadsheet className="w-10 h-10 text-indigo-400/50" />
                  </div>
                  <h2 className="text-2xl font-bold text-white">Nenhuma planilha configurada</h2>
                  <p className="text-slate-400 max-w-sm mx-auto">
                    {dataSource === 'google' 
                      ? "Para usar o assistente, vá nas Configurações e selecione a planilha de dados do seu Google Drive."
                      : "Para usar o assistente, vá nas Configurações e faça upload ou cole os dados da sua planilha local."}
                  </p>
                  <button 
                    onClick={() => setCurrentView('settings')}
                    className="mt-6 px-8 py-3 bg-indigo-500/80 backdrop-blur-sm text-white rounded-xl font-medium hover:bg-indigo-600/80 border border-indigo-400/30 transition shadow-lg inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Settings className="w-5 h-5"/> Abrir Configurações
                  </button>
                </div>
              ) : (
                <div className="space-y-8 animate-in fade-in duration-300">
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
                        {dataSource === 'google' ? 'Aba ativa' : 'Origem'}: <span className="text-white font-mono font-bold">{dataSource === 'google' ? (selectedSheetName || "Não configurada") : `${localSourceName} (${localUploadedSheetData?.length || 0} linhas lidas)`}</span>
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
            </div>
          )}
          
        </main>
      </div>

      {/* Floating Bottom capsule Navigation Dock (Estilo Cirene com Divisões) */}
      {!needsAuth && user && (
        <div
          className="fixed left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-lg bg-slate-900/90 border border-white/20 backdrop-blur-xl rounded-2xl shadow-[0_12px_40px_-4px_rgba(0,0,0,0.8)] z-50 overflow-hidden flex items-center justify-between"
          style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
        >
          
          {/* Tab 1: Análise */}
          <button
            type="button"
            onClick={() => setCurrentView('analysis')}
            className={`flex-1 py-3 px-1 flex flex-col items-center justify-center gap-1 cursor-pointer group transition-all duration-300 relative ${
              currentView === 'analysis' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            {currentView === 'analysis' && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-indigo-400 rounded-b-md shadow-[0_2px_10px_rgba(129,140,248,0.5)] animate-bounce"></span>
            )}
            <FileSpreadsheet className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110 ${currentView === 'analysis' ? 'text-indigo-400' : 'text-slate-400 group-hover:text-white'}`} />
            <span className="text-[10px] sm:text-xs font-semibold tracking-tight">Análise</span>
          </button>

          {/* Divider */}
          <div className="h-6 w-px bg-white/10 shrink-0"></div>

          {/* Tab 2: Wallet */}
          <button
            type="button"
            onClick={() => setCurrentView('wallet')}
            className={`flex-1 py-3 px-1 flex flex-col items-center justify-center gap-1 cursor-pointer group transition-all duration-300 relative ${
              currentView === 'wallet' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            {currentView === 'wallet' && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-indigo-400 rounded-b-md shadow-[0_2px_10px_rgba(129,140,248,0.5)] animate-bounce"></span>
            )}
            <Wallet className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110 ${currentView === 'wallet' ? 'text-indigo-400' : 'text-slate-400 group-hover:text-white'}`} />
            <span className="text-[10px] sm:text-xs font-semibold tracking-tight">Wallet</span>
          </button>

          {/* Divider */}
          <div className="h-6 w-px bg-white/10 shrink-0"></div>

          {/* Tab 3: Dashboard */}
          <button
            type="button"
            onClick={() => setCurrentView('dashboard')}
            className={`flex-1 py-3 px-1 flex flex-col items-center justify-center gap-1 cursor-pointer group transition-all duration-300 relative ${
              currentView === 'dashboard' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            {currentView === 'dashboard' && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-indigo-400 rounded-b-md shadow-[0_2px_10px_rgba(129,140,248,0.5)] animate-bounce"></span>
            )}
            <LayoutDashboard className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110 ${currentView === 'dashboard' ? 'text-indigo-400' : 'text-slate-400 group-hover:text-white'}`} />
            <span className="text-[10px] sm:text-xs font-semibold tracking-tight">Dashboard</span>
          </button>

          {/* Divider */}
          <div className="h-6 w-px bg-white/10 shrink-0"></div>

          {/* Tab 4: Configurações */}
          <button
            type="button"
            onClick={() => setCurrentView('settings')}
            className={`flex-1 py-3 px-1 flex flex-col items-center justify-center gap-1 cursor-pointer group transition-all duration-300 relative ${
              currentView === 'settings' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            {currentView === 'settings' && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-indigo-400 rounded-b-md shadow-[0_2px_10px_rgba(129,140,248,0.5)] animate-bounce"></span>
            )}
            <Settings className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110 ${currentView === 'settings' ? 'text-indigo-400' : 'text-slate-400 group-hover:text-white'}`} />
            <span className="text-[10px] sm:text-xs font-semibold tracking-tight">Ajustes</span>
          </button>
        </div>
      )}
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

class ErrorBoundary extends React.Component<{ children: React.ReactNode; key?: string }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Error boundary caught:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <AlertTriangle className="w-12 h-12 text-red-400" />
          <p className="text-slate-300 text-lg">Algo deu errado no Dashboard.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-2 bg-indigo-600 rounded-lg text-white hover:bg-indigo-500 transition"
          >
            Tentar novamente
          </button>
          <button
            onClick={() => {
              this.setState({ hasError: false });
              localStorage.setItem('app_current_view', 'analysis');
              window.location.reload();
            }}
            className="px-4 py-2 bg-slate-700 rounded-lg text-slate-300 hover:bg-slate-600 transition"
          >
            Voltar para Análise
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

