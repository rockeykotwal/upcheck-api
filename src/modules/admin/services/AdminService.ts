import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import { TOKENS } from '../../../tokens';
import { CompanyRepository } from '../../status/repositories/CompanyRepository';
import { AppError } from '../../../errors/AppError';
import type { Company, NewCompany, CompanyStatus } from '../../status/models/company.schema';

@injectable()
export class AdminService {
  constructor(
    @inject(TOKENS.CompanyRepository) private readonly companies: CompanyRepository,
  ) {}

  async listAll(): Promise<Company[]> {
    return this.companies.findAllAdmin();
  }

  async addCompany(data: NewCompany): Promise<Company> {
    const existing = await this.companies.findBySlug(data.slug);
    if (existing) throw new AppError('A company with this slug already exists', 409);
    return this.companies.create(data);
  }

  async setStatus(slug: string, status: CompanyStatus): Promise<Company> {
    const company = await this.companies.updateStatus(slug, status);
    if (!company) throw new AppError('Company not found', 404);
    return company;
  }

  async deleteCompany(slug: string): Promise<void> {
    const deleted = await this.companies.deleteBySlug(slug);
    if (!deleted) throw new AppError('Company not found', 404);
  }
}
