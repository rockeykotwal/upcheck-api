import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { StatusPollerService } from '../../../src/modules/status/services/StatusPollerService';
import type { StatusFetcherService } from '../../../src/modules/status/services/StatusFetcherService';
import type { SnapshotRepository } from '../../../src/modules/status/repositories/SnapshotRepository';
import type { AlertService } from '../../../src/modules/alert/services/AlertService';
import type { FetchResult } from '../../../src/modules/status/types/statuspage.types';

function makeResult(slug: string, ok: boolean, indicator = 'none'): FetchResult {
  return {
    companyId: `id-${slug}`,
    slug,
    ok,
    status: ok ? { companyId: `id-${slug}`, slug, indicator: indicator as never, description: 'OK', fetchedAt: new Date() } : undefined,
    error: ok ? undefined : 'timeout',
  };
}

function buildPoller(results: FetchResult[], prevIndicator: string | null = null) {
  const fetcher = {
    fetchAll: vi.fn().mockResolvedValue(results),
  } as unknown as StatusFetcherService;

  const snapshots = {
    saveMany: vi.fn().mockResolvedValue(undefined),
    findLatestBySlug: vi.fn().mockResolvedValue(
      prevIndicator ? { indicator: prevIndicator } : null
    ),
  } as unknown as SnapshotRepository;

  const alerts = {
    notifyStatusChange: vi.fn().mockResolvedValue(undefined),
  } as unknown as AlertService;

  const poller = new StatusPollerService(fetcher, snapshots, alerts);
  return { poller, fetcher, snapshots, alerts };
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

  it('fires alert when indicator changes from none to minor', async () => {
    const results = [makeResult('github', true, 'minor')];
    const { poller, alerts } = buildPoller(results, 'none');

    await poller.poll();

    expect(alerts.notifyStatusChange).toHaveBeenCalledOnce();
    expect(alerts.notifyStatusChange).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'github', prevIndicator: 'none', nextIndicator: 'minor' })
    );
  });

  it('fires alert when indicator recovers to none', async () => {
    const results = [makeResult('github', true, 'none')];
    const { poller, alerts } = buildPoller(results, 'major');

    await poller.poll();

    expect(alerts.notifyStatusChange).toHaveBeenCalledOnce();
    expect(alerts.notifyStatusChange).toHaveBeenCalledWith(
      expect.objectContaining({ prevIndicator: 'major', nextIndicator: 'none' })
    );
  });

  it('does not fire alert when indicator is unchanged', async () => {
    const results = [makeResult('github', true, 'none')];
    const { poller, alerts } = buildPoller(results, 'none');

    await poller.poll();

    expect(alerts.notifyStatusChange).not.toHaveBeenCalled();
  });
});
