import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import { TOKENS } from '../../../tokens';
import { CompanyRepository } from '../repositories/CompanyRepository';
import { SnapshotRepository } from '../repositories/SnapshotRepository';
import type { Company } from '../models/company.schema';
import type { StatusSnapshot } from '../types/snapshot.types';

export interface CompanyStatus {
  company:  Company;
  current:  StatusSnapshot | null;
}

export interface CompanyDetail {
  company:  Company;
  current:  StatusSnapshot | null;
  history:  StatusSnapshot[];
}

@injectable()
export class StatusService {
  constructor(
    @inject(TOKENS.CompanyRepository)  private readonly companies: CompanyRepository,
    @inject(TOKENS.SnapshotRepository) private readonly snapshots: SnapshotRepository,
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

  async getDetail(slug: string): Promise<CompanyDetail | null> {
    const companies = await this.companies.findAll();
    const company   = companies.find((c) => c.slug === slug) ?? null;

    if (!company) return null;

    const [current, history] = await Promise.all([
      this.snapshots.findLatestBySlug(slug),
      this.snapshots.findRecentBySlug(slug, 20),
    ]);

    return { company, current, history };
  }
}
