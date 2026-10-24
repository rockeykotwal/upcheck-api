import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import { randomBytes } from 'crypto';
import { TOKENS } from '../../../tokens';
import { CompanyRepository } from '../repositories/CompanyRepository';
import { SnapshotRepository } from '../repositories/SnapshotRepository';
import { WatchlistRepository } from '../../watchlist/repositories/WatchlistRepository';
import { AppError } from '../../../errors/AppError';
import type { Company } from '../models/company.schema';
import type { StatusSnapshot } from '../types/snapshot.types';

export interface MonitorWithStatus {
  company:  Company;
  current:  StatusSnapshot | null;
}

@injectable()
export class MonitorService {
  constructor(
    @inject(TOKENS.CompanyRepository)   private readonly companies: CompanyRepository,
    @inject(TOKENS.SnapshotRepository)  private readonly snapshots: SnapshotRepository,
    @inject(TOKENS.WatchlistRepository) private readonly watchlist: WatchlistRepository,
  ) {}

  async create(userId: string, name: string, url: string): Promise<Company> {
    try {
      new URL(url);
    } catch {
      throw new AppError('Invalid URL — must be a full URL including http:// or https://', 400);
    }

    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const slug = `${base}-${randomBytes(3).toString('hex')}`;

    const company = await this.companies.create({
      name,
      slug,
      statusPageUrl: url,
      provider:      'http',
      userId,
    });

    await this.watchlist.watch(userId, company.id);

    return company;
  }

  async listByUser(userId: string): Promise<MonitorWithStatus[]> {
    const companies = await this.companies.findByUserId(userId);
    return Promise.all(
      companies.map(async (company): Promise<MonitorWithStatus> => ({
        company,
        current: await this.snapshots.findLatestBySlug(company.slug),
      })),
    );
  }

  async deleteByUser(userId: string, slug: string): Promise<void> {
    const deleted = await this.companies.deleteBySlugAndUser(slug, userId);
    if (!deleted) throw new AppError('Monitor not found or not owned by you', 404);
  }
}
