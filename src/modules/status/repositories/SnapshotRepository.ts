import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import type { Db } from 'mongodb';
import { TOKENS } from '../../../tokens';
import type { StatusSnapshot, UptimeStats } from '../types/snapshot.types';
import type { FetchResult } from '../types/statuspage.types';
import { getCache, setCache, deleteCache } from '../../../cache/redis';

const COLLECTION = 'status_snapshots';

const SNAPSHOT_KEY = (slug: string) => `snapshot:latest:${slug}`;
const SNAPSHOT_TTL = 65; // slightly longer than the 60s poll interval

const UPTIME_KEY = (slug: string) => `uptime:${slug}`;
const UPTIME_TTL = 300; // 5 minutes — aggregation is expensive, minor drift is fine

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

async function uptimePct(col: ReturnType<Db['collection']>, slug: string, since: Date): Promise<number> {
  const [total, healthy] = await Promise.all([
    col.countDocuments({ slug, fetchedAt: { $gte: since } }),
    col.countDocuments({ slug, fetchedAt: { $gte: since }, indicator: 'none' }),
  ]);
  if (total === 0) return 100;
  return Math.round((healthy / total) * 1000) / 10;
}

@injectable()
export class SnapshotRepository {
  constructor(@inject(TOKENS.MongoDb) private readonly db: Db) {}

  async saveMany(results: FetchResult[]): Promise<void> {
    const docs: StatusSnapshot[] = results
      .filter((r) => r.ok && r.status)
      .map((r) => r.status!);

    if (docs.length === 0) return;

    await this.db.collection<StatusSnapshot>(COLLECTION).insertMany(docs, { ordered: false });

    // Invalidate cached "latest" snapshots so next read sees the fresh data
    await Promise.all(docs.map((doc) => deleteCache(SNAPSHOT_KEY(doc.slug))));
  }

  async findLatestBySlug(slug: string): Promise<StatusSnapshot | null> {
    const cached = await getCache<StatusSnapshot>(SNAPSHOT_KEY(slug));
    if (cached) return cached;

    const snapshot = await this.db
      .collection<StatusSnapshot>(COLLECTION)
      .findOne({ slug }, { sort: { fetchedAt: -1 } });

    if (snapshot) await setCache(SNAPSHOT_KEY(slug), snapshot, SNAPSHOT_TTL);
    return snapshot;
  }

  async findRecentBySlug(slug: string, limit = 50): Promise<StatusSnapshot[]> {
    return this.db
      .collection<StatusSnapshot>(COLLECTION)
      .find({ slug })
      .sort({ fetchedAt: -1 })
      .limit(limit)
      .toArray();
  }

  async getUptimeStats(slug: string): Promise<UptimeStats> {
    const cached = await getCache<UptimeStats>(UPTIME_KEY(slug));
    if (cached) return cached;

    const col = this.db.collection(COLLECTION);
    const [h24, d7, d30] = await Promise.all([
      uptimePct(col, slug, daysAgo(1)),
      uptimePct(col, slug, daysAgo(7)),
      uptimePct(col, slug, daysAgo(30)),
    ]);
    const stats = { h24, d7, d30 };
    await setCache(UPTIME_KEY(slug), stats, UPTIME_TTL);
    return stats;
  }
}
