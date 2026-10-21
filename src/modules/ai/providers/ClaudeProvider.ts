import 'reflect-metadata';
import { injectable } from 'tsyringe';
import { config } from '../../../config';
import { logger } from '../../../observability/logger';
import { AppError } from '../../../errors/AppError';
import type { AiProvider } from './AiProvider';

interface ClaudeResponse {
  content: Array<{ text: string }>;
}

@injectable()
export class ClaudeProvider implements AiProvider {
  async complete(prompt: string): Promise<string> {
    const { apiKey, model } = config.ai.claude;

    let res: Response;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method:  'POST',
        headers: {
          'content-type':      'application/json',
          'x-api-key':         apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
    } catch (err) {
      logger.error('Claude request failed', { error: (err as Error).message });
      throw new AppError('AI provider unavailable', 503, false);
    }

    if (!res.ok) {
      logger.error('Claude returned error', { status: res.status });
      throw new AppError('AI provider error', 502, false);
    }

    const body = await res.json() as ClaudeResponse;
    const text = body.content[0]?.text ?? '';
    return text.trim();
  }
}
