# Stocks Analyzer - App Logic
npm run dev
http://loquero, agoacalhost:3000
## Visão Geral
App que analisa planilhas do Google Sheets (3 abas: AÇÕES, FII, S&P 500) usando IA Gemini 3.5 Flash para gerar rankings Top 10, montar carteira e simular performance.

## Lógica Analítica do App

O app analisa a planilha do usuário e seleciona **as 10 melhores opções de cada categoria** (AÇÕES, FII, S&P 500) usando IA, gerando relatórios na página "Análise".

### Critérios de Análise por Categoria

- Ler as instruções do cabeçário das colunas dos índices das ações/FII's para escolher a ação com os melhores índices

#### Ações Brasileiras
- **Estratégia:** QARP (Quality at a Reasonable Price)
- **Colunas usadas (0-indexed):**
  - **Dividend Yield** (Coluna I / index 8)
  - **EV/EBITDA** (Coluna K / index 10) — ideal entre 4x e 12x
  - **ROE** (Coluna L / index 11) — ideal acima de 15%
- **Relatório gerado:** "Top 10 Melhores Ações"
  - Abre com lista numerada: `1. TICKER - Setor`
  - Seções por ativo: Posição, Setor, Fundamentos (EV/EBITDA, ROE, DY), Motivo
  - Explica por que o 1º colocado é o melhor
  - Orientação sobre diversificação setorial

#### FIIs (Fundos Imobiliários)
- **Estratégia:** Análise genérica dos dados da planilha (sem colunas fixas)
- **Critérios considerados:** Dividend Yield, P/VP, vacância, liquidez
- **Relatório gerado:** "Top 10 Melhores FIIs"
  - Abre com lista numerada: `1. TICKER - Tipo/Segmento`
  - Seções por ativo: Posição, Tipo/Segmento (Papel, Tijolo-Logística, etc.), Motivo
  - Análise do equilíbrio Papel vs Tijolo
  - Orientação sobre diversificação entre setores

#### S&P 500
- **Estratégia:** QARP (Quality at a Reasonable Price)
- **Colunas usadas (0-indexed):**
  - **Dividend Yield** (Coluna I / index 8)
  - **EV/EBITDA** (Coluna K / index 10) — ideal entre 4x e 12x
  - **ROE** (Coluna L / index 11) — ideal acima de 15%
- **Relatório gerado:** "Top 10 Melhores Ações S&P 500"
  - Abre com lista numerada: `1. TICKER - Setor`
  - Seções por ativo: Posição, Setor, Fundamentos (EV/EBITDA, ROE, DY), Motivo
  - Foco em crescimento patrimonial a médio/longo prazo
  - Orientação sobre diversificação (setores defensivos vs cíclicos)

### Regras Gerais dos Relatórios
- Escritos **integralmente em português**
- **Sempre começam** com o resumo numerado dos 10 escolhidos (sem introdução antes)
- **Proibido listar mais de 10 ativos** ou todos os ativos da planilha
- **Proibido usar tabelas** — usar títulos, listas e parágrafos
- Estrutura padrão:
  1. Resumo numerado (1. TICKER - descrição)
  2. Avaliação geral de mercado
  3. Ranking detalhado (seções individuais)
  4. Por que o 1º é o melhor
  5. Recomendações finais / diversificação

### Seleção Final da Carteira (10 ativos)

Após as 3 análises individuais (AÇÕES, FII, S&P 500), o app **combina os melhores ativos de cada categoria** em uma única carteira de **10 tickers** (misturando Ações, FIIs e S&P 500).

**Objetivo:** Escolher a composição que:
- **Supere o CDI** no período simulado (Jan-Mai 2026), ou
- **Gere o maior valor** no card **"Patrimônio Consolidado"** no "Simulador de Carteira" da página Dashboard

**3 estratégias de alocação pré-definidas:**
- **Renda:** 5 FIIs + 3 Ações + 2 S&P 500
- **Equilibrada:** 4 FIIs + 3 Ações + 3 S&P 500  
- **Crescimento:** 5 S&P 500 + 3 Ações + 2 FIIs

A carteira final é salva em `localStorage` como `saved_interactive_wallet_full` (10 assets + pesos) e exibida no Dashboard para simulação de performance com preços reais.

## Planilha Google Sheets
- **ID:** `1snMSkObwpfq-H9tKqUYcByi-uWWC7xWYFab18dMaEMs`
- **3 abas:** AÇÕES, FII, S&P 500
- **Cabeçalho com explicações** dos índices usados

### Colunas esperadas (0-indexed)
| Index | Letra | Conteúdo |
|-------|-------|----------|
| 0 | A | Ticker (ex: VALE3, AAPL) |
| 1 | B | Nome do ativo |
| 2 | C | Setor |
| 8 | I | Dividend Yield |
| 10 | K | EV/EBITDA |
| 11 | L | ROE |

## Fluxo de Dados

### 1. Upload/Conexão
- **Google Drive:** Autenticação Firebase OAuth 2.0 (escopos: drive.readonly, spreadsheets.readonly)
- **Local:** Upload CSV ou colar dados
- Token armazenado em localStorage/sessionStorage como `google_access_token`

### 2. Análise por IA
-ler as instruções do cabeçário das colunas dos indices das ações/FII's
- POST `/api/process-data` → servidor envia dados + prompt para **Gemini 3.5 Flash**
- Prompt específico para cada tipo (AÇÕES, FII, S&P 500)
- Retorna ranking Top 10 em Markdown
- Resultados salvos em localStorage: `stocks_analysis_result`, `fii_analysis_result`, `sp500_analysis_result`

### 3. Montagem da Carteira (WalletView)
- Lê ranking da IA + dados da planilha
- Extrai: preço atual, yield, setor de cada ticker
- 3 estratégias de alocação:
  - **Renda:** 5 FIIs + 3 Ações + 2 S&P 500
  - **Equilibrada:** 4 FIIs + 3 Ações + 3 S&P 500
  - **Crescimento:** 5 S&P 500 + 3 Ações + 2 FIIs
- 10 ativos com pesos que somam 100%

### 4. Dashboard (DashboardView)

## O grafico de barras "Dividend Yields por Ativo (%)- Ult. 12 meses" deve se basear  - para  AÇÕES: 
 na COLUNA I (Div. Yield)   

- para FII's:
  na COLUNA H (DY (Ano)) da planilha Google sheets

## Tabelas de Preços (DashboardView.tsx)
- `PRECO INICIAL" (conforme Data Inicial)` — Preços de fechamento de Data Inicial (Yahoo Finance)
Formula =INDEX(GOOGLEFINANCE(Ticker; "close"; Data); 2; 2)
- `PRECOS_ATUAIS` — Preços atuais de mercado (TODAY, Yahoo Finance)
Formula =GOOGLEFINANCE(Ticker)


## Servidor (server.ts)
- Express na porta 3000
- `/api/process-data` — Análise via Gemini
- `/api/historical-price` — Proxy Yahoo Finance
- `/api/wallet-insight` — Análise da carteira via Gemini
- `/api/save-token` / `/api/get-token` — Persistência de token OAuth

## Chaves localStorage importantes
| Key | Descrição |
|-----|-----------|
| `local_uploaded_sheet_data` | Dados brutos da planilha |
| `saved_interactive_wallet_full` | Carteira completa (10 ativos + pesos) |
| `saved_wallet_budget` | Orçamento (R$ 125.000 padrão) |
| `stocks_analysis_result` | Resultado análise Ações |
| `fii_analysis_result` | Resultado análise FIIs |
| `sp500_analysis_result` | Resultado análise S&P 500 |
| `active_strategy` | Estratégia ativa |
| `google_access_token` | Token OAuth Google |
| `data_source` | 'google' ou 'local' |

## Deploy
- Publicado no Google AI Studio: `https://ai.studio/apps/da9468b6-4298-48e2-90d1-3f8216d2b6c0`
- Atualização manual via Share/Export no AI Studio

## Coluna "Preço Atual"

**Documentação Técnica: Cálculo de "Preço Atual"**
A obtenção do preço unitário de um ativo (b3PrecoUn) segue estes passos:
Normalização do Ticker:
O ticker é limpo: espaços são removidos, convertido para maiúsculas e remove-se sufixos como .SA ou prefixos como BVMF:.
Exemplo: PETR4.SA torna-se PETR4.
Consulta à API de Mercado (Brapi):
O sistema realiza uma requisição fetch para https://brapi.dev/api/quote/{ticker}.
É necessário um token de autenticação (API Token) configurado nas variáveis de ambiente.
A requisição exige timeout de 8 segundos para evitar travamento da interface.
Obtenção do Preço:
A resposta da API é um JSON. O sistema acessa o primeiro resultado (data.results[0]).
O valor do preço unitário retornado é definido pelo campo: regularMarketPrice.
Fallback (Segurança):
Se a API falhar, não retornar dados ou o ticker for inválido, a função retorna null (ou 0 na lógica final que preenche o campo b3PrecoUn).
Como o valor é utilizado no código principal:
code
TypeScript
// 1. Busca as informações de mercado baseada no ticker e data
const marketInfo = await fetchFinancialMarketInfo(ticker, formattedDate);

// 2. Define o preço unitário (se não encontrar, define como 0)
const b3PrecoUn = marketInfo?.price || 0;
A "fórmula" é:
b3PrecoUn = API_Resultado.regularMarketPrice (ou 0, caso a API falhe).



## Codigo da Data Inicial do Dashboard


<!DOCTYPE html>
<html>

<head>
    <style>
    body {
        min-height: 100vh;
        display: flex;
        justify-content: center;
        align-items: center;
        background: linear-gradient( to right, #000428, #004e92);
    }
    
    .calendar {
        position: relative;
        width: 260px;
    }
    
    .calendar .calendar-body {
        display: flex;
        justify-content: center;
        align-items: center;
        flex-direction: column;
        font-size: 30px;
        transform: translate(-50%, -50%);
        width: 400px;
        height: 400px;
        background: rgba(255, 255, 255, 0.1);
        border: 2px solid rgba(255, 255, 255, 0.1);
        box-shadow: 30px 30px 40px rgba(0, 0, 0, 0.2);
        border-radius: 80px;
        backdrop-filter: blur(10px);
    }
    
    .circle {
        width: 150px;
        height: 150px;
        border-radius: 50%;
        background: linear-gradient(to right, #833ab4, #fd1d1d, #fcb045);
        position: relative;
        left: 170px;
        top: 50px;
    }
    
    .month {
        color: #fff;
        background: green;
        width: 100%;
        font-size: 1.7em;
        text-align: center;
        padding: 5px 0;
    }
    
    .day {
        color: #fff;
        font-size: 1.4em;
        margin-top: 20px;
    }
    
    .date {
        color: #fff;
        font-size: 6em;
        margin-bottom: 20px;
    }
    
    .year {
        color: #fff;
        font-size: 1.2em;
        margin-bottom: 20px;
    }
    </style>
</head>

<body>
    <div class="calendar">
        <div class="circle"></div>
        <div class="calendar-body">
             <span class="month">August</span>
             <span class="day">Thursday</span> 
             <span class="date">17</span> 
             <span class="year">2021</span> 
        </div>
    </div>
</body>

</html>




## Codigo da grafico Pizza do Dashboard


<div className="flex items-center justify-center p-8 bg-gradient-to-br from-indigo-900 via-slate-900 to-blue-900 min-h-screen">
  <div className="relative w-full max-w-md p-6 rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl shadow-2xl shadow-black/40 text-white">
    <h3 className="text-lg font-semibold tracking-wide mb-6 text-white/90 text-center">Distribuição de Recursos</h3>
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-around">
      <div className="relative w-40 h-40">
        <svg viewBox="0 0 32 32" className="w-full h-full transform -rotate-90 rounded-full drop-shadow-[0_4px_12px_rgba(0,0,0,0.3)]">
          <defs>
            <linearGradient id="grad-0" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ff007f" stop-opacity="0.85" /><stop offset="100%" stop-color="#7f00ff" stop-opacity="0.85" /></linearGradient>
            <linearGradient id="grad-1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#00f2fe" stop-opacity="0.85" /><stop offset="100%" stop-color="#4facfe" stop-opacity="0.85" /></linearGradient>
            <linearGradient id="grad-2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#00ff87" stop-opacity="0.85" /><stop offset="100%" stop-color="#60efff" stop-opacity="0.85" /></linearGradient>
          </defs>
          <circle cx="16" cy="16" r="15.915494" fill="transparent" stroke="url(#grad-0)" stroke-width="4" stroke-dasharray="40 60" stroke-dashoffset="0" />
          <circle cx="16" cy="16" r="15.915494" fill="transparent" stroke="url(#grad-1)" stroke-width="4" stroke-dasharray="35 65" stroke-dashoffset="-40" />
          <circle cx="16" cy="16" r="15.915494" fill="transparent" stroke="url(#grad-2)" stroke-width="4" stroke-dasharray="25 75" stroke-dashoffset="-75" />
        </svg>
        <div className="absolute inset-6 rounded-full border border-white/10 bg-black/20 backdrop-blur-md flex items-center justify-center">
          <span className="text-[10px] text-white/60 font-medium">Total 100%</span>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3"><span className="w-3 h-3 rounded-full" style="background: linear-gradient(135deg, #ff007f, #7f00ff)"></span><div className="flex flex-col"><span className="text-sm font-medium text-white/80">Design</span><span className="text-xs text-white/50">40%</span></div></div>
        <div className="flex items-center gap-3"><span className="w-3 h-3 rounded-full" style="background: linear-gradient(135deg, #00f2fe, #4facfe)"></span><div className="flex flex-col"><span className="text-sm font-medium text-white/80">Dev</span><span className="text-xs text-white/50">35%</span></div></div>
        <div className="flex items-center gap-3"><span className="w-3 h-3 rounded-full" style="background: linear-gradient(135deg, #00ff87, #60efff)"></span><div className="flex flex-col"><span className="text-sm font-medium text-white/80">Marketing</span><span className="text-xs text-white/50">25%</span></div></div>
      </div>
    </div>
  </div>
</div>






## GAUGES



import React, { useEffect, useState } from 'react';
import styled, { keyframes } from 'styled-components';

// 1. Tipagem das Propriedades (TypeScript)
interface GlassGaugeProps {
  value: number; // Valor final do medidor (0 a 100)
  title?: string;
  subtitle?: string;
}

// 2. Animações CSS (Keyframes)
const fillProgress = (offsetFinal: number) => keyframes`
  from {
    stroke-dashoffset: 314.16; /* Circunferência total (vazio) */
  }
  to {
    stroke-dashoffset: ${offsetFinal}; /* Posição do valor final */
  }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
`;

// 3. Componentes Estilizados (Interface e Glassmorphism)
const GlassCard = styled.div`
  position: relative;
  width: 240px;
  padding: 24px;
  border-radius: 28px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(15, 32, 67, 0.45); 
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.2);
  animation: ${fadeIn} 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
`;

const GlowEffect = styled.div`
  position: absolute;
  bottom: -20%;
  left: 50%;
  transform: translateX(-50%);
  width: 140px;
  height: 140px;
  background: radial-gradient(circle, rgba(0, 210, 255, 0.3) 0%, rgba(0, 0, 0, 0) 70%);
  border-radius: 50%;
  pointer-events: none;
`;

const Header = styled.div`
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

const Title = styled.span`
  color: rgba(255, 255, 255, 0.95);
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 16px;
  font-weight: 600;
`;

const Dots = styled.span`
  color: rgba(255, 255, 255, 0.5);
  font-weight: bold;
`;

const GaugeContainer = styled.div`
  position: relative;
  width: 160px;
  height: 160px;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const SvgGauge = styled.svg`
  transform: rotate(-90deg);
  width: 100%;
  height: 100%;
`;

const CircleBackground = styled.circle`
  fill: none;
  stroke: rgba(255, 255, 255, 0.08);
  stroke-width: 8;
`;

// O segredo do preenchimento animado está aqui:
const CircleProgress = styled.circle<{ $offsetFinal: number }>`
  fill: none;
  stroke: #00d2ff;
  stroke-width: 8;
  stroke-linecap: round;
  filter: drop-shadow(0px 0px 8px rgba(0, 210, 255, 0.9));
  stroke-dasharray: 314.16; /* 2 * PI * 50 */
  
  /* Aplica a animação de corrida inicial de 1.2 segundos */
  animation: ${props => fillProgress(props.$offsetFinal)} 1.2s cubic-bezier(0.1, 0.8, 0.2, 1) forwards;
`;

const GaugeText = styled.div`
  position: absolute;
`;

const Percentage = styled.span`
  color: #ffffff;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 28px;
  font-weight: 700;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
`;

const FooterText = styled.div`
  margin-top: 16px;
  color: rgba(255, 255, 255, 0.7);
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 14px;
`;

// 4. Componente Principal
export const GlassGauge: React.FC<GlassGaugeProps> = ({ 
  value, 
  title = "Sinal", 
  subtitle = "Excelente" 
}) => {
  const clampedValue = Math.max(0, Math.min(100, value));
  
  // Lógica de cálculo do SVG
  const radius = 50;
  const circumference = 2 * Math.PI * radius; // 314.16
  const strokeDashoffsetFinal = circumference - (clampedValue / 100) * circumference;

  // Estado para fazer os números internos subirem de 0 até o valor final na mesma velocidade da animação
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const duration = 1200; // Mesma duração do CSS (1.2s)
    const stepTime = Math.abs(Math.floor(duration / clampedValue));
    
    if (clampedValue === 0) return;

    const timer = setInterval(() => {
      start += 1;
      setDisplayValue(start);
      if (start >= clampedValue) {
        clearInterval(timer);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [clampedValue]);

  return (
    <GlassCard>
      <GlowEffect />
      <Header>
        <Title>{title}</Title>
        <Dots>•••</Dots>
      </Header>

      <GaugeContainer>
        <SvgGauge viewBox="0 0 120 120">
          <CircleBackground cx="60" cy="60" r={radius} />
          <CircleProgress
            cx="60"
            cy="60"
            r={radius}
            $offsetFinal={strokeDashoffsetFinal}
          />
        </SvgGauge>
        
        <GaugeText>
          <Percentage>{displayValue}%</Percentage>
        </GaugeText>
      </GaugeContainer>

      <FooterText>{subtitle}</FooterText>
    </GlassCard>
  );
};






## LÓGICA DO APP



A lógica é:

Do total de 30 ativos analisados (Top 10 Ações + Top 10 FIIs + Top 10 S&P 500), selecionar os 10 melhores para maximizar o patrimônio consolidado.

Preciso criar um algoritmo de scoring que classifica os 30 e pega os melhores 10 com diversificação mínima. Vou implementar isso agora:


