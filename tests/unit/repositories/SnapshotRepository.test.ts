import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SnapshotRepository } from '../../../src/modules/status/repositories/SnapshotRepository';
import type { FetchResult, StatusIndicator } from '../../../src/modules/status/types/statuspage.types';
import type { StatusSnapshot } from '../../../src/modules/status/types/snapshot.types';

vi.mock('../../../src/cache/redis', () => ({
  getCache:    vi.fn().mockResolvedValue(null),
  setCache:    vi.fn().mockResolvedValue(undefined),
  deleteCache: vi.fn().mockResolvedValue(undefined),
}));

import { getCache, setCache, deleteCache } from '../../../src/cache/redis';

function makeResult(slug: string, indicator: StatusIndicator = 'none', ok = true): FetchResult {
  return {
    companyId: `id-${slug}`,
    slug,
    ok,
    status: ok ? { companyId: `id-${slug}`, slug, indicator, description: 'All good', fetchedAt: new Date() } : undefined,
    error: ok ? undefined : 'network error',
  };
}

function makeDb(overrides: Record<string, unknown> = {}) {
  const cursor = {
    sort:  vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    toArray: vi.fn().mockResolvedValue([]),
  };
  const collection = {
    insertMany: vi.fn().mockResolvedValue({ insertedCount: 0 }),
    findOne:    vi.fn().mockResolvedValue(null),
    find:       vi.fn().mockReturnValue(cursor),
    ...overrides,
  };
  return {
    db: { collection: vi.fn().mockReturnValue(collection) } as unknown as import('mongodb').Db,
    collection,
    cursor,
  };
}

beforeEach(() => {
  vi.mocked(getCache).mockResolvedValue(null);
  vi.mocked(setCache).mockResolvedValue(undefined);
  vi.mocked(deleteCache).mockResolvedValue(undefined);
});

describe('SnapshotRepository', () => {
  describe('saveMany', () => {
    it('inserts only successful fetch results', async () => {
      const { db, collection } = makeDb();
      const repo = new SnapshotRepository(db);

      await repo.saveMany([
        makeResult('github', 'none', true),
        makeResult('stripe', 'none', false),
        makeResult('cloudflare', 'minor', true),
      ]);

      expect(collection.insertMany).toHaveBeenCalledOnce();
      const inserted = collection.insertMany.mock.calls[0]![0] as StatusSnapshot[];
      expect(inserted).toHaveLength(2);
      expect(inserted.map((d) => d.slug)).toEqual(['github', 'cloudflare']);
    });

    it('invalidates cache for each successfully inserted slug', async () => {
      const { db } = makeDb();
      const repo = new SnapshotRepository(db);

      await repo.saveMany([
        makeResult('github', 'none', true),
        makeResult('stripe', 'none', false),
        makeResult('cloudflare', 'minor', true),
      ]);

      expect(deleteCache).toHaveBeenCalledTimes(2);
      expect(deleteCache).toHaveBeenCalledWith('snapshot:latest:github');
      expect(deleteCache).toHaveBeenCalledWith('snapshot:latest:cloudflare');
    });

    it('does nothing when all results failed', async () => {
      const { db, collection } = makeDb();
      const repo = new SnapshotRepository(db);

      await repo.saveMany([makeResult('github', 'none', false)]);

      expect(collection.insertMany).not.toHaveBeenCalled();
      expect(deleteCache).not.toHaveBeenCalled();
    });

    it('does nothing when results array is empty', async () => {
      const { db, collection } = makeDb();
      const repo = new SnapshotRepository(db);

      await repo.saveMany([]);

      expect(collection.insertMany).not.toHaveBeenCalled();
    });
  });

  describe('findLatestBySlug', () => {
    it('returns cached snapshot without hitting MongoDB', async () => {
      const snapshot: StatusSnapshot = {
        companyId: 'id-github', slug: 'github', indicator: 'none',
        description: 'All Systems Operational', fetchedAt: new Date(), components: [],
      };
      vi.mocked(getCache).mockResolvedValueOnce(snapshot);
      const { db, collection } = makeDb();
      const repo = new SnapshotRepository(db);

      const result = await repo.findLatestBySlug('github');

      expect(result).toEqual(snapshot);
      expect(collection.findOne).not.toHaveBeenCalled();
    });

    it('fetches from MongoDB on cache miss and caches the result', async () => {
      const snapshot: StatusSnapshot = {
        companyId: 'id-github', slug: 'github', indicator: 'none',
        description: 'All Systems Operational', fetchedAt: new Date(), components: [],
      };
      const { db, collection } = makeDb({ findOne: vi.fn().mockResolvedValue(snapshot) });
      const repo = new SnapshotRepository(db);

      const result = await repo.findLatestBySlug('github');

      expect(result).toEqual(snapshot);
      expect(collection.findOne).toHaveBeenCalledWith({ slug: 'github' }, { sort: { fetchedAt: -1 } });
      expect(setCache).toHaveBeenCalledWith('snapshot:latest:github', snapshot, 65);
    });

    it('returns null and does not cache when no snapshot exists', async () => {
      const { db } = makeDb();
      const repo = new SnapshotRepository(db);

      const result = await repo.findLatestBySlug('unknown-service');

      expect(result).toBeNull();
      expect(setCache).not.toHaveBeenCalled();
    });
  });

  describe('findRecentBySlug', () => {
    it('returns snapshots sorted by fetchedAt desc with default limit', async () => {
      const snapshots: StatusSnapshot[] = [
        { companyId: 'id-github', slug: 'github', indicator: 'none', description: 'OK', fetchedAt: new Date() },
        { companyId: 'id-github', slug: 'github', indicator: 'minor', description: 'Degraded', fetchedAt: new Date() },
      ];
      const cursor = {
        sort:    vi.fn().mockReturnThis(),
        limit:   vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue(snapshots),
      };
      const { db } = makeDb({ find: vi.fn().mockReturnValue(cursor) });
      const repo = new SnapshotRepository(db);

      const result = await repo.findRecentBySlug('github');

      expect(result).toEqual(snapshots);
      expect(cursor.sort).toHaveBeenCalledWith({ fetchedAt: -1 });
      expect(cursor.limit).toHaveBeenCalledWith(50);
    });

    it('respects a custom limit', async () => {
      const cursor = {
        sort:    vi.fn().mockReturnThis(),
        limit:   vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([]),
      };
      const { db } = makeDb({ find: vi.fn().mockReturnValue(cursor) });
      const repo = new SnapshotRepository(db);

      await repo.findRecentBySlug('github', 5);

      expect(cursor.limit).toHaveBeenCalledWith(5);
    });
  });
});
