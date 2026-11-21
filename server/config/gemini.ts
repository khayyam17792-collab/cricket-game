import { GoogleGenAI, ThinkingLevel } from '@google/genai';

let cachedAiClient: GoogleGenAI | null = null;
let hydrogenCooldownUntil = 0;
let liteCooldownUntil = 0;

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  if (!cachedAiClient) {
    cachedAiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedAiClient;
}

function isQuotaOrRateLimitError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (status === 429) return true;
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return (
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.toLowerCase().includes('quota') ||
    msg.toLowerCase().includes('rate')
  );
}

export async function generateWithModelFallback(options: {
  contents: string;
  systemInstruction?: string;
  responseMimeType?: string;
  responseSchema?: unknown;
}): Promise<string | null> {
  const ai = getAiClient();
  if (!ai) return null;

  const tryModel = async (
    model: 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite',
    thinkingLevel: ThinkingLevel,
  ): Promise<string | null> => {
    const response = await ai.models.generateContent({
      model,
      contents: options.contents,
      config: {
        thinkingConfig: { thinkingLevel },
        ...(options.systemInstruction
          ? { systemInstruction: options.systemInstruction }
          : {}),
        ...(options.responseMimeType
          ? { responseMimeType: options.responseMimeType }
          : {}),
        ...(options.responseSchema
          ? { responseSchema: options.responseSchema as never }
          : {}),
      },
    });
    const text = (response.text ?? '').trim();
    return text || null;
  };

  if (Date.now() >= hydrogenCooldownUntil) {
    try {
      return await tryModel('gemini-4-hydrogen', ThinkingLevel.LOW);
    } catch (err) {
      if (isQuotaOrRateLimitError(err)) {
        hydrogenCooldownUntil = Date.now() + 10 * 60_000;
        console.warn(
          'gemini-4-hydrogen quota exhausted; switching to gemini-3.1-flash-lite fallback.',
        );
      } else {
        throw err;
      }
    }
  }

  if (Date.now() >= liteCooldownUntil) {
    try {
      return await tryModel('gemini-3.1-flash-lite', ThinkingLevel.MINIMAL);
    } catch (err) {
      if (isQuotaOrRateLimitError(err)) {
        liteCooldownUntil = Date.now() + 10 * 60_000;
        console.warn(
          'gemini-3.1-flash-lite quota exhausted; using local broadcast fallback.',
        );
        return null;
      }
      throw err;
    }
  }

  return null;
}
