import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface Attachment {
  name: string;
  type: string;
  data: string; // base64
}

export async function generateInitialDraft(prompt: string, attachments: Attachment[]): Promise<string> {
  const parts: any[] = [];
  
  for (const att of attachments) {
    parts.push({
      inlineData: {
        mimeType: att.type,
        data: att.data.split(',')[1], // remove data:image/png;base64,
      }
    });
  }
  
  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: { parts },
    config: {
      systemInstruction: "You are an expert ghostwriter and editor. Write a high-quality draft based on the user's prompt and any provided attachments. Output ONLY the draft text, formatted with markdown paragraphs and headings if necessary. Do not include introductory or concluding remarks.",
    }
  });

  return response.text || "";
}

export async function rewriteText(text: string, instruction: string, context: string): Promise<string> {
  const prompt = `
Context of the full document:
${context}

Text to rewrite:
"${text}"

Instruction: ${instruction}

Rewrite the text according to the instruction. Output ONLY the rewritten text, nothing else.
`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      systemInstruction: "You are an expert editor. Rewrite the provided text based on the instruction. Output ONLY the rewritten text.",
    }
  });

  return response.text || text;
}

export interface Suggestion {
  id: string;
  originalText: string;
  suggestedText: string;
  reason: string;
}

export async function getProactiveSuggestions(fullText: string): Promise<Suggestion[]> {
  if (!fullText || fullText.trim().length < 50) return [];

  const prompt = `
Review the following text and provide 1-3 proactive suggestions for improvement. 
Focus on clarity, flow, tone, or impactful phrasing.
Identify a specific short phrase or sentence (originalText) that could be improved, provide a suggested rewrite (suggestedText), and briefly explain why (reason).

Text to review:
${fullText}
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              originalText: { type: Type.STRING, description: "The exact text from the document to be replaced." },
              suggestedText: { type: Type.STRING, description: "The improved text." },
              reason: { type: Type.STRING, description: "Brief reason for the suggestion." }
            },
            required: ["originalText", "suggestedText", "reason"]
          }
        }
      }
    });

    const jsonStr = response.text?.trim() || "[]";
    const suggestions = JSON.parse(jsonStr);
    return suggestions.map((s: any) => ({ ...s, id: Math.random().toString(36).substring(7) }));
  } catch (e) {
    console.error("Failed to get proactive suggestions", e);
    return [];
  }
}
