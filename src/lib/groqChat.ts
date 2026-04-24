/**
 * groqChat.ts
 * Shared Groq API helper for all 3 chatbots (Patient, Doctor, Admin).
 * Uses llama3-70b-8192 via the Groq REST API directly (no SDK needed in browser).
 */

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY as string;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama3-70b-8192';

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function groqChat(messages: GroqMessage[]): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error('VITE_GROQ_API_KEY is not set in your .env file');
  }

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 1024,
      stream: false,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? 'No response from AI.';
}
