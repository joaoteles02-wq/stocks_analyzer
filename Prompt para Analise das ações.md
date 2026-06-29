##### Prompt para Analise das ações :



Por favor, atue como um Engenheiro de Software especialista em Python, Streamlit e Análise Financeira. Preciso que você implemente uma nova funcionalidade (um módulo ou aba) no meu aplicativo Streamlit (Exodus) para conectar a uma planilha dinâmica do Google Sheets, escolher as 10 melhores opções de investimento de cada aba e realizar uma análise automatizada delas.



Aqui estão as especificações detalhadas da implementação:



1\. CONEXÃO DINÂMICA (ATUALIZAÇÃO DE 20 EM 20 MINUTOS):

\- O aplicativo deve se conectar à planilha pública no endereço: https://docs.google.com/spreadsheets/d/1snMSkObwpfq-H9tKqUYcByi-uWWC7xWYFab18dMaEMs/edit

\- Use st.cache\_data com um TTL (Time-To-Live) de exatamente 1200 segundos (20 minutos) para garantir que os dados sejam baixados novamente a cada ciclo de atualização da planilha, sem estourar o limite de requisições da API.

\- O aplicativo deve carregar três abas distintas da planilha: "AÇÕES", "FII" e "S\&P 500" (verifique se os nomes das abas correspondem ou use os GIDs correspondentes para exportação direta em CSV/Dataframe).



2\. ESTRATÉGIA DE SELEÇÃO (RANKING DAS 10 MELHORES PARA RETORNO FINANCEIRO):

Para cada categoria, aplique as seguintes regras matemáticas para encontrar as 10 melhores:

\- ABA "AÇÕES" (Brasil): Aplicar a Fórmula Mágica de Joel Greenblatt (ordenar as ações combinando o ranking de menor EV/EBIT com maior ROIC). Eliminar ações com liquidez muito baixa ou distorções causadas por recuperação judicial (ex: RPMG3, OSXB3 se houver).

\- ABA "FII" (Fundos Imobiliários): Ordenar os fundos priorizando o maior Dividend Yield (DY) combinado com um P/VP (Preço sobre Valor Patrimonial) entre 0.85 e 1.05 (garantindo desconto patrimonial sem comprar fundos excessivamente arriscados).

\- ABA "S\&P 500" (EUA): Aplicar a adaptação da Fórmula Mágica para o mercado americano (Earnings Yield + Return on Capital) ou ordenar por maior LPA (Lucro por Ação) e margem de segurança.



3\. ANÁLISE AUTOMATIZADA DOS TOP 10:

Após selecionar as 10 melhores de cada categoria, o sistema deve computar e exibir em um dashboard:

\- Diversificação Setorial: Um gráfico (pizza ou barras) mostrando a distribuição de setores das ações escolhidas para alertar sobre concentração de risco.

\- Saúde Financeira Média: Média de Dívida Líquida/Patrimônio Líquido das selecionadas.

\- Retorno Esperado Estimado: Projeção de Dividend Yield médio da carteira selecionada e a distância média para o Preço Justo de Graham.



4\. INTERFACE DO USUÁRIO (UI/UX):

\- Crie um layout limpo, moderno e responsivo usando Streamlit.

\- Use abas visuais (st.tabs) para separar os rankings de "Ações", "FIIs", "S\&P 500" e a "Análise Consolidada".

\- Formate todos os valores monetários em BRL/USD, percentuais com "%" e mostre um indicador visual ("badge") do setor de cada ativo.

