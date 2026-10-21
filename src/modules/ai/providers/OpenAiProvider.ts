import 'reflect-metadata';
import { injectable } from 'tsyringe';
import { config } from '../../../config';
import { logger } from '../../../observability/logger';
import { AppError } from '../../../errors/AppError';
import type { AiProvider } from './AiProvider';

interface OpenAiResponse {
  choices: Array<{
    message: { content: string };
  }>;
}

@injectable()
export class OpenAiProvider implements AiProvider {
  async complete(prompt: string): Promise<string> {
    const { apiKey, model } = config.ai.openai;

    let res: Response;
    try {
      res = await fetch('https://api.openai.com/v1/chat/completions', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
    } catch (err) {
      logger.error('OpenAI request failed', { error: (err as Error).message });
      throw new AppError('AI provider unavailable', 503, false);
    }

    if (!res.ok) {
      logger.error('OpenAI returned error', { status: res.status });
      throw new AppError('AI provider error', 502, false);
    }

    const body = await res.json() as OpenAiResponse;
    const text = body.choices[0]?.message.content ?? '';
    return text.trim();
  }
}
