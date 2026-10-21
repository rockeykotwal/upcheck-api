import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import type { Db } from 'mongodb';
import { TOKENS } from '../../../tokens';
import type { StatusSnapshot } from '../types/snapshot.types';
import type { FetchResult } from '../types/statuspage.types';

const COLLECTION = 'status_snapshots';

@injectable()
export class SnapshotRepository {
  constructor(@inject(TOKENS.MongoDb) private readonly db: Db) {}

  async saveMany(results: FetchResult[]): Promise<void> {
    const docs: StatusSnapshot[] = results
      .filter((r) => r.ok && r.status)
      .map((r) => r.status!);

    if (docs.length === 0) return;

    await this.db.collection<StatusSnapshot>(COLLECTION).insertMany(docs, { ordered: false });
  }

  async findLatestBySlug(slug: string): Promise<StatusSnapshot | null> {
    return this.db
      .collection<StatusSnapshot>(COLLECTION)
      .findOne({ slug }, { sort: { fetchedAt: -1 } });
  }

  async findRecentBySlug(slug: string, limit = 20): Promise<StatusSnapshot[]> {
    return this.db
      .collection<StatusSnapshot>(COLLECTION)
      .find({ slug })
      .sort({ fetchedAt: -1 })
      .limit(limit)
      .toArray();
  }
}
