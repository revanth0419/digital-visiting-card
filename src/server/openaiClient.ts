import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  console.warn("[openaiClient] Missing OPENAI_API_KEY.");
}

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

