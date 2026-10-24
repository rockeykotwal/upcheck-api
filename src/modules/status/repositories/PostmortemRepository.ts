import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import type { Db } from 'mongodb';
import { TOKENS } from '../../../tokens';
import type { Postmortem } from '../types/postmortem.types';

const COLLECTION = 'incident_postmortems';

@injectable()
export class PostmortemRepository {
  constructor(@inject(TOKENS.MongoDb) private readonly db: Db) {}

  async save(postmortem: Postmortem): Promise<void> {
    await this.db.collection<Postmortem>(COLLECTION).insertOne(postmortem);
  }

  async findBySlug(slug: string, limit = 10): Promise<Postmortem[]> {
    return this.db
      .collection<Postmortem>(COLLECTION)
      .find({ slug })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }
}
