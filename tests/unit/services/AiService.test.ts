import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { AiService } from '../../../src/modules/ai/services/AiService';
import type { AiProvider } from '../../../src/modules/ai/providers/AiProvider';
import type { SnapshotRepository } from '../../../src/modules/status/repositories/SnapshotRepository';
import type { StatusSnapshot } from '../../../src/modules/status/types/snapshot.types';

function makeSnapshot(indicator: string, description: string): StatusSnapshot {
  return {
    companyId:   'id-github',
    slug:        'github',
    indicator:   indicator as StatusSnapshot['indicator'],
    description,
    fetchedAt:   new Date('2024-01-01T10:00:00Z'),
  };
}

function buildService(snapshots: StatusSnapshot[], summary = 'All good.') {
  const provider: AiProvider = {
    complete: vi.fn().mockResolvedValue(summary),
  };

  const snapshotRepo = {
    findRecentBySlug: vi.fn().mockResolvedValue(snapshots),
  } as unknown as SnapshotRepository;

  const service = new AiService(provider, snapshotRepo);
  return { service, provider, snapshotRepo };
}

describe('AiService.summarize', () => {
  it('returns the provider summary for a known slug with history', async () => {
    const history = [makeSnapshot('none', 'All Systems Operational')];
    const { service } = buildService(history, 'GitHub has been fully operational.');

    const result = await service.summarize('github');

    expect(result).toBe('GitHub has been fully operational.');
  });

  it('throws 404 when no snapshots exist for the slug', async () => {
    const { service } = buildService([]);

    await expect(service.summarize('unknown')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('calls findRecentBySlug with limit 20', async () => {
    const history = [makeSnapshot('none', 'OK')];
    const { service, snapshotRepo } = buildService(history);

    await service.summarize('github');

    expect(snapshotRepo.findRecentBySlug).toHaveBeenCalledWith('github', 20);
  });

  it('passes a prompt containing the slug and history to the provider', async () => {
    const history = [makeSnapshot('major', 'Service Outage')];
    const { service, provider } = buildService(history);

    await service.summarize('github');

    const prompt = (provider.complete as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string;
    expect(prompt).toContain('github');
    expect(prompt).toContain('Service Outage');
  });
});
