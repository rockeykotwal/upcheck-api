import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { TOKENS } from '../../../tokens';
import { companiesTable } from '../models/company.schema';
import type { Company } from '../models/company.schema';

type Db = NodePgDatabase<Record<string, never>>;

@injectable()
export class CompanyRepository {
  constructor(@inject(TOKENS.DrizzleDb) private readonly db: Db) {}

  async findAll(): Promise<Company[]> {
    return this.db.select().from(companiesTable);
  }
}
