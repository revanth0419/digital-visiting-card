import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.warn("[openaiClient] Missing OPENAI_API_KEY. AI features will be disabled.");
}

export const openai = new OpenAI({
  apiKey: apiKey || "dummy-key-for-initialization",
  dangerouslyAllowBrowser: true // purely to silence some potential client-side reuse warnings if any
});

