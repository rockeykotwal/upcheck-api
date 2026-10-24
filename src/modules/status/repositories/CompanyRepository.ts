import 'reflect-metadata';
import { injectable, inject } from 'tsyringe';
import { and, eq, isNotNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { TOKENS } from '../../../tokens';
import { companiesTable } from '../models/company.schema';
import type { Company, NewCompany, CompanyStatus } from '../models/company.schema';

type Db = NodePgDatabase<Record<string, never>>;

@injectable()
export class CompanyRepository {
  constructor(@inject(TOKENS.DrizzleDb) private readonly db: Db) {}

  async findAll(): Promise<Company[]> {
    return this.db.select().from(companiesTable).where(eq(companiesTable.status, 'active'));
  }

  async findAllAdmin(): Promise<Company[]> {
    return this.db.select().from(companiesTable);
  }

  async findById(id: string): Promise<Company | null> {
    const rows = await this.db.select().from(companiesTable).where(eq(companiesTable.id, id));
    return rows[0] ?? null;
  }

  async findBySlug(slug: string): Promise<Company | null> {
    const rows = await this.db.select().from(companiesTable).where(eq(companiesTable.slug, slug));
    return rows[0] ?? null;
  }

  async create(data: NewCompany): Promise<Company> {
    const rows = await this.db.insert(companiesTable).values(data).returning();
    return rows[0]!;
  }

  async updateStatus(slug: string, status: CompanyStatus): Promise<Company | null> {
    const rows = await this.db
      .update(companiesTable)
      .set({ status })
      .where(eq(companiesTable.slug, slug))
      .returning();
    return rows[0] ?? null;
  }

  async deleteBySlug(slug: string): Promise<boolean> {
    const rows = await this.db
      .delete(companiesTable)
      .where(eq(companiesTable.slug, slug))
      .returning();
    return rows.length > 0;
  }

  async findByUserId(userId: string): Promise<Company[]> {
    return this.db
      .select()
      .from(companiesTable)
      .where(and(eq(companiesTable.userId, userId), eq(companiesTable.status, 'active')));
  }

  async findAllCustom(): Promise<Company[]> {
    return this.db
      .select()
      .from(companiesTable)
      .where(isNotNull(companiesTable.userId));
  }

  async deleteBySlugAndUser(slug: string, userId: string): Promise<boolean> {
    const rows = await this.db
      .delete(companiesTable)
      .where(and(eq(companiesTable.slug, slug), eq(companiesTable.userId, userId)))
      .returning();
    return rows.length > 0;
  }
}
