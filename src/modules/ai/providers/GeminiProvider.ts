import 'reflect-metadata';
import { injectable } from 'tsyringe';
import { config } from '../../../config';
import { logger } from '../../../observability/logger';
import { AppError } from '../../../errors/AppError';
import type { AiProvider } from './AiProvider';

interface GeminiResponse {
  candidates: Array<{
    content: { parts: Array<{ text: string }> };
  }>;
}

@injectable()
export class GeminiProvider implements AiProvider {
  async complete(prompt: string): Promise<string> {
    const { apiKey, model } = config.ai.gemini;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    let res: Response;
    try {
      res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
    } catch (err) {
      logger.error('Gemini request failed', { error: (err as Error).message });
      throw new AppError('AI provider unavailable', 503, false);
    }

    if (!res.ok) {
      logger.error('Gemini returned error', { status: res.status });
      throw new AppError('AI provider error', 502, false);
    }

    const body = await res.json() as GeminiResponse;
    const text = body.candidates[0]?.content.parts[0]?.text ?? '';
    return text.trim();
  }
}
