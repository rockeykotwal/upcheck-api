import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { StatusPollerService } from '../../../src/modules/status/services/StatusPollerService';
import type { StatusFetcherService } from '../../../src/modules/status/services/StatusFetcherService';
import type { SnapshotRepository } from '../../../src/modules/status/repositories/SnapshotRepository';
import type { FetchResult } from '../../../src/modules/status/types/statuspage.types';

function makeResult(slug: string, ok: boolean): FetchResult {
  return {
    companyId: `id-${slug}`,
    slug,
    ok,
    status: ok ? { companyId: `id-${slug}`, slug, indicator: 'none', description: 'OK', fetchedAt: new Date() } : undefined,
    error: ok ? undefined : 'timeout',
  };
}

function buildPoller(results: FetchResult[]) {
  const fetcher = {
    fetchAll: vi.fn().mockResolvedValue(results),
  } as unknown as StatusFetcherService;

  const snapshots = {
    saveMany: vi.fn().mockResolvedValue(undefined),
  } as unknown as SnapshotRepository;

  const poller = new StatusPollerService(fetcher, snapshots);
  return { poller, fetcher, snapshots };
}

describe('StatusPollerService.poll', () => {
  it('calls fetchAll and saveMany in order', async () => {
    const results = [makeResult('github', true), makeResult('stripe', true)];
    const { poller, fetcher, snapshots } = buildPoller(results);

    await poller.poll();

    expect(fetcher.fetchAll).toHaveBeenCalledOnce();
    expect(snapshots.saveMany).toHaveBeenCalledOnce();
    expect(snapshots.saveMany).toHaveBeenCalledWith(results);
  });

  it('passes all results to saveMany including failures', async () => {
    const results = [makeResult('github', true), makeResult('stripe', false)];
    const { poller, snapshots } = buildPoller(results);

    await poller.poll();

    const saved = (snapshots.saveMany as ReturnType<typeof vi.fn>).mock.calls[0]![0] as FetchResult[];
    expect(saved).toHaveLength(2);
  });

  it('completes successfully when all fetches fail', async () => {
    const results = [makeResult('github', false), makeResult('stripe', false)];
    const { poller, snapshots } = buildPoller(results);

    await expect(poller.poll()).resolves.toBeUndefined();
    expect(snapshots.saveMany).toHaveBeenCalledOnce();
  });

  it('completes successfully when results array is empty', async () => {
    const { poller, snapshots } = buildPoller([]);

    await expect(poller.poll()).resolves.toBeUndefined();
    expect(snapshots.saveMany).toHaveBeenCalledWith([]);
  });
});
