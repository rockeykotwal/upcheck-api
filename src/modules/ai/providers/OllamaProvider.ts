import 'reflect-metadata';
import { injectable } from 'tsyringe';
import { config } from '../../../config';
import { logger } from '../../../observability/logger';
import { AppError } from '../../../errors/AppError';
import type { AiProvider } from './AiProvider';

@injectable()
export class OllamaProvider implements AiProvider {
  async complete(prompt: string): Promise<string> {
    const url = `${config.ai.ollama.baseUrl}/api/generate`;

    let res: Response;
    try {
      res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ model: config.ai.ollama.model, prompt, stream: false }),
      });
    } catch (err) {
      logger.error('Ollama request failed', { error: (err as Error).message });
      throw new AppError('AI provider unavailable', 503, false);
    }

    if (!res.ok) {
      logger.error('Ollama returned error', { status: res.status });
      throw new AppError('AI provider error', 502, false);
    }

    const body = await res.json() as { response: string };
    return body.response.trim();
  }
}
