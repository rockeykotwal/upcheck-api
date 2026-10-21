import { pgTable, text, timestamp, uuid, pgEnum } from 'drizzle-orm/pg-core';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';

export const companyStatusEnum = pgEnum('company_status', ['active', 'paused', 'retired']);

export type CompanyStatus = 'active' | 'paused' | 'retired';

export const companiesTable = pgTable('companies', {
  id:            uuid('id').primaryKey().defaultRandom(),
  name:          text('name').notNull(),
  slug:          text('slug').notNull().unique(),
  logoUrl:       text('logo_url'),
  statusPageUrl: text('status_page_url').notNull(),
  provider:      text('provider').notNull().default('statuspage'),
  category:      text('category'),
  status:        companyStatusEnum('status').notNull().default('active'),
  createdAt:     timestamp('created_at').defaultNow(),
});

export type Company    = InferSelectModel<typeof companiesTable>;
export type NewCompany = InferInsertModel<typeof companiesTable>;
