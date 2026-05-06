import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function parseProfileText(text: string) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `以下のテキストは法廷・法曹関係者の経歴やプロフィールです。このテキストから情報を抽出し、指定のJSON形式で出力してください。外字や旧字体が含まれる場合は、できるだけ正確に保持してください。また、ふりがながない場合や予測できる場合は、一般的な読み方を予測して「ひらがな」で補完してください。

テキスト:
${text}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            lastName: { type: Type.STRING },
            firstName: { type: Type.STRING },
            lastNameKana: { type: Type.STRING, description: "ひらがな" },
            firstNameKana: { type: Type.STRING, description: "ひらがな" },
            jobTitle: { type: Type.STRING },
            mergedLastName: { type: Type.STRING },
            birthEra: { type: Type.STRING, enum: ["昭和", "平成", "令和", ""] },
            birthYear: { type: Type.STRING },
            birthMonth: { type: Type.STRING },
            birthDay: { type: Type.STRING },
            birthPlace: { type: Type.STRING },
            careerList: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  date: { type: Type.STRING, description: "例: 平成2年4月" },
                  content: { type: Type.STRING, description: "例: 司法修習生（東京）" }
                }
              }
            }
          }
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
  } catch (error) {
    console.error("AI Parsing Error:", error);
  }
  return null;
}

export async function predictKana(text: string) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `「${text}」の人名としての一般的な読み方をひらがなで出力してください。出力はひらがなのみとし、他の文字や説明は一切含めないでください。`,
    });
    return response.text?.trim() || "";
  } catch (err) {
    return "";
  }
}
