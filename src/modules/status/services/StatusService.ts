import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import { TOKENS } from '../../../tokens';
import { CompanyRepository } from '../repositories/CompanyRepository';
import { SnapshotRepository } from '../repositories/SnapshotRepository';
import { PostmortemRepository } from '../repositories/PostmortemRepository';
import type { Company } from '../models/company.schema';
import type { StatusSnapshot, UptimeStats } from '../types/snapshot.types';
import type { Postmortem } from '../types/postmortem.types';

export interface CompanyStatus {
  company:  Company;
  current:  StatusSnapshot | null;
}

export interface CompanyDetail {
  company:  Company;
  current:  StatusSnapshot | null;
  history:  StatusSnapshot[];
  uptime:   UptimeStats;
}

@injectable()
export class StatusService {
  constructor(
    @inject(TOKENS.CompanyRepository)    private readonly companies: CompanyRepository,
    @inject(TOKENS.SnapshotRepository)   private readonly snapshots: SnapshotRepository,
    @inject(TOKENS.PostmortemRepository) private readonly postmortems: PostmortemRepository,
  ) {}

  async listAll(): Promise<CompanyStatus[]> {
    const companies = await this.companies.findAll();

    const statuses = await Promise.all(
      companies.map(async (company): Promise<CompanyStatus> => ({
        company,
        current: await this.snapshots.findLatestBySlug(company.slug),
      })),
    );

    return statuses;
  }

  async search(query: string): Promise<CompanyStatus[]> {
    const all = await this.listAll();
    const q   = query.toLowerCase().trim();
    return all.filter(
      ({ company }) =>
        company.name.toLowerCase().includes(q) ||
        company.slug.toLowerCase().includes(q),
    );
  }

  async getPostmortems(slug: string): Promise<Postmortem[]> {
    return this.postmortems.findBySlug(slug);
  }

  async getDetail(slug: string): Promise<CompanyDetail | null> {
    const company = await this.companies.findBySlug(slug);

    if (!company) return null;

    const [current, history, uptime] = await Promise.all([
      this.snapshots.findLatestBySlug(slug),
      this.snapshots.findRecentBySlug(slug),
      this.snapshots.getUptimeStats(slug),
    ]);

    return { company, current, history, uptime };
  }
}
