import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import { TOKENS } from '../../../tokens';
import { WatchlistRepository } from '../repositories/WatchlistRepository';
import { CompanyRepository }   from '../../status/repositories/CompanyRepository';
import { SnapshotRepository }  from '../../status/repositories/SnapshotRepository';
import { AppError } from '../../../errors/AppError';
import type { Company } from '../../status/models/company.schema';
import type { StatusSnapshot } from '../../status/types/snapshot.types';

export interface WatchlistItem {
  company:  Company;
  current:  StatusSnapshot | null;
  watching: true;
}

@injectable()
export class WatchlistService {
  constructor(
    @inject(TOKENS.WatchlistRepository) private readonly watchlist: WatchlistRepository,
    @inject(TOKENS.CompanyRepository)   private readonly companies: CompanyRepository,
    @inject(TOKENS.SnapshotRepository)  private readonly snapshots: SnapshotRepository,
  ) {}

  async watch(userId: string, slug: string): Promise<void> {
    const company = await this.companies.findBySlug(slug);
    if (!company) throw new AppError('Company not found', 404);
    await this.watchlist.watch(userId, company.id);
  }

  async unwatch(userId: string, slug: string): Promise<void> {
    const company = await this.companies.findBySlug(slug);
    if (!company) throw new AppError('Company not found', 404);
    await this.watchlist.unwatch(userId, company.id);
  }

  async getWatchlist(userId: string): Promise<WatchlistItem[]> {
    const entries = await this.watchlist.findByUserId(userId);
    if (entries.length === 0) return [];

    const items = await Promise.all(
      entries.map(async (entry): Promise<WatchlistItem | null> => {
        const company = await this.companies.findById(entry.companyId);
        if (!company) return null;
        const current = await this.snapshots.findLatestBySlug(company.slug);
        return { company, current, watching: true };
      }),
    );

    return items.filter((i): i is WatchlistItem => i !== null);
  }

  async isWatching(userId: string, slug: string): Promise<boolean> {
    const company = await this.companies.findBySlug(slug);
    if (!company) return false;
    return this.watchlist.isWatching(userId, company.id);
  }
}
