import { pgTable, uuid, timestamp, unique } from 'drizzle-orm/pg-core';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { usersTable }     from '../../users/models/user.schema';
import { companiesTable } from '../../status/models/company.schema';

export const watchlistTable = pgTable(
  'watchlist',
  {
    id:        uuid('id').primaryKey().defaultRandom(),
    userId:    uuid('user_id').notNull().references(() => usersTable.id,     { onDelete: 'cascade' }),
    companyId: uuid('company_id').notNull().references(() => companiesTable.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => ({ uniqueUserCompany: unique().on(t.userId, t.companyId) }),
);

export type WatchlistEntry    = InferSelectModel<typeof watchlistTable>;
export type NewWatchlistEntry = InferInsertModel<typeof watchlistTable>;
