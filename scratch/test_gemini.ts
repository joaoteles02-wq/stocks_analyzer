import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

async function test() {
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Olá, analise a minha carteira fictícia PETR4, VALE3, ITUB4.',
      config: {
        systemInstruction: "Você é um analista financeiro sênior especializado em mercado de capitais e assessoria de investimentos. Sua diretriz mais sagrada e inviolável é gerar um ranking de exatamente 10 ativos (Top 10) baseados nos dados fornecidos na planilha do usuário. Você está terminantemente proibido de listar todos os ativos, todos os 187 ativos lidos ou qualquer ativo além dos 10 melhores selecionados. O sumário inicial e o ranking detalhado subsequente devem constar exatamente 10 ativos (nem mais, nem menos). Escreva integralmente em português."
      }
    });
    console.log("Success! Response length:", response.text ? response.text.length : 0);
    console.log("Response text first 100 chars:", response.text ? response.text.substring(0, 100) : "empty");
  } catch (error: any) {
    console.error("Error encountered:", error);
  }
}

test();
