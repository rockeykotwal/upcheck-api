import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import { TOKENS } from '../../../tokens';
import { SnapshotRepository } from '../../status/repositories/SnapshotRepository';
import { AppError } from '../../../errors/AppError';
import type { AiProvider } from '../providers/AiProvider';
import type { StatusSnapshot } from '../../status/types/snapshot.types';

function buildPrompt(slug: string, history: StatusSnapshot[]): string {
  const lines = history.map(
    (s) => `- ${s.fetchedAt.toISOString()}: ${s.indicator} — ${s.description}`,
  );

  return [
    `You are an incident analyst. Summarize the recent status history for the service "${slug}" in 2-3 plain sentences.`,
    'Focus on what went wrong, when it started, and whether it has resolved.',
    'If everything looks normal, say so briefly.',
    '',
    'Recent status snapshots (newest first):',
    ...lines,
  ].join('\n');
}

@injectable()
export class AiService {
  constructor(
    @inject(TOKENS.AiProvider)        private readonly provider: AiProvider,
    @inject(TOKENS.SnapshotRepository) private readonly snapshots: SnapshotRepository,
  ) {}

  async summarize(slug: string): Promise<string> {
    const history = await this.snapshots.findRecentBySlug(slug, 20);

    if (!history.length) {
      throw new AppError(`No snapshot data found for "${slug}"`, 404);
    }

    return this.provider.complete(buildPrompt(slug, history));
  }
}
