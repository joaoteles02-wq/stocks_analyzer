# Stocks Analyzer - App Logic
http://localhost:3000
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



