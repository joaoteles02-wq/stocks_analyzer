---
trigger: always_on
---

# GEMINI.md — Stocks Analyzer

> ⚠️ **ATENÇÃO: Este projeto é o STOCKS ANALYZER — NÃO é o Exodus V2.**
> São projetos completamente diferentes. Nunca confunda os dois.

---

## 🆔 Identidade do Projeto

| Campo         | Valor                                                                 |
|---------------|-----------------------------------------------------------------------|
| **Nome**      | Stocks Analyzer                                                       |
| **Tipo**      | Web App (React + TypeScript + Vite)                                   |
| **Caminho**   | `C:\Users\joaot\Projetos\stocks_analyzer`                             |
| **GitHub**    | https://github.com/joaoteles02-wq/stocks_analyzer                    |
| **Vercel**    | https://stocks-analyzer-nine.vercel.app (nome: `stocks-analyzer`)     |
| **Backend**   | API em `api/` (Node/TypeScript) + Firebase                            |

---

## ❌ NÃO CONFUNDIR COM

| Projeto       | Caminho                             | GitHub                                      |
|---------------|-------------------------------------|---------------------------------------------|
| **Exodus V2** | `C:\Users\joaot\Projetos\Exodus`    | https://github.com/joaoteles02-wq/Exodus-V2 |

**Exodus V2** é um dashboard financeiro em **Streamlit (Python)**.  
**Stocks Analyzer** é um app de análise de ações em **React + TypeScript**.

---

## 🏗️ Stack Técnica

- **Frontend**: React 18, TypeScript, Vite
- **Estilo**: CSS/Tailwind
- **Backend/API**: Node.js + TypeScript (`server.ts`, pasta `api/`)
- **Database**: Firebase
- **Deploy**: Vercel (CI/CD automático via push no GitHub)
- **Branch principal**: `main`

---

## 📁 Estrutura Principal

```
stocks_analyzer/
├── src/                  # Código fonte React
│   ├── App.tsx           # Componente raiz
│   └── components/       # Componentes da UI
├── api/                  # Endpoints serverless (Vercel)
├── public/               # Assets estáticos
├── dist/                 # Build gerado
├── server.ts             # Servidor local de dev
├── index.html            # Entry point HTML
├── package.json          # Dependências
└── .vercel/              # Config do deploy Vercel
```

---

## 🚀 Comandos Principais

```bash
# Instalar dependências
npm install

# Rodar em desenvolvimento local
npm run dev

# Build de produção
npm run build

# Enviar alterações para GitHub (triggers deploy automático no Vercel)
git add .
git commit -m "feat: descrição"
git push origin main
```

---

## 🔄 Fluxo de Deploy

1. `git push origin main` → GitHub
2. Vercel detecta o push automaticamente
3. Build executado na Vercel (~20s)
4. App atualizado em: https://stocks-analyzer-theta.vercel.app
5. Acesso pelo celular via mesmo URL

---

## 🤖 Regras para o Agente

- **Agente primário**: `frontend-specialist` (React/TypeScript)
- **Para API/backend**: `backend-specialist`
- **Nunca** aplicar regras ou contexto do Exodus V2 neste projeto
- Sempre commitar para `main` para acionar o deploy automático
