import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { TOKENS } from '../../../tokens';
import { watchlistTable } from '../models/watchlist.schema';
import type { WatchlistEntry } from '../models/watchlist.schema';

type Db = NodePgDatabase<Record<string, never>>;

@injectable()
export class WatchlistRepository {
  constructor(@inject(TOKENS.DrizzleDb) private readonly db: Db) {}

  async watch(userId: string, companyId: string): Promise<WatchlistEntry> {
    const rows = await this.db
      .insert(watchlistTable)
      .values({ userId, companyId })
      .onConflictDoNothing()
      .returning();
    // If already watching, fetch the existing row
    if (rows.length > 0) return rows[0]!;
    const existing = await this.db
      .select()
      .from(watchlistTable)
      .where(and(eq(watchlistTable.userId, userId), eq(watchlistTable.companyId, companyId)));
    return existing[0]!;
  }

  async unwatch(userId: string, companyId: string): Promise<boolean> {
    const rows = await this.db
      .delete(watchlistTable)
      .where(and(eq(watchlistTable.userId, userId), eq(watchlistTable.companyId, companyId)))
      .returning();
    return rows.length > 0;
  }

  async findByUserId(userId: string): Promise<WatchlistEntry[]> {
    return this.db.select().from(watchlistTable).where(eq(watchlistTable.userId, userId));
  }

  async findByCompanyId(companyId: string): Promise<WatchlistEntry[]> {
    return this.db.select().from(watchlistTable).where(eq(watchlistTable.companyId, companyId));
  }

  async isWatching(userId: string, companyId: string): Promise<boolean> {
    const rows = await this.db
      .select()
      .from(watchlistTable)
      .where(and(eq(watchlistTable.userId, userId), eq(watchlistTable.companyId, companyId)));
    return rows.length > 0;
  }
}
