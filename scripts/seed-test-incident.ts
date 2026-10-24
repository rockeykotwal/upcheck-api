/**
 * Seeds a clean fake incident into MongoDB for a given company slug so that
 * the natural poll cycle detects a recovery event and fires the Postmortem
 * and Prediction agents automatically.
 *
 * What it does:
 *  1. Deletes all existing snapshots for the slug from the last 2 hours (removes
 *     interleaved real polls that would break the contiguous incident window).
 *  2. Inserts a clean contiguous block: 10 × minor → 9 × major escalation,
 *     with the most recent snapshot timestamped to NOW.
 *  3. Clears the Redis cache for the slug so the poller reads our fake 'major'
 *     as the previous indicator on its next run.
 *
 * After running, within ≤60 seconds the poller will:
 *  - Detect prev='major' → real 'none' → trigger PostmortemService + AlertService
 *  - (Prediction fires only if the poller catches the slug while indicator is non-none,
 *    which won't happen for stable services like GitHub — use a service that is
 *    currently degraded, or wait for a real incident.)
 *
 * Usage:
 *   npx tsx scripts/seed-test-incident.ts [slug]
 *   npx tsx scripts/seed-test-incident.ts github
 */

import * as dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { Pool } from 'pg';
import Redis from 'ioredis';

dotenv.config();

const SLUG       = process.argv[2] ?? 'github';
const COLLECTION = 'status_snapshots';
const TWO_HOURS  = 2 * 60 * 60 * 1000;

async function main() {
  // ── PostgreSQL: get real companyId ──────────────────────────────────────────
  const pg = new Pool({
    host:     process.env.DB_HOST,
    port:     Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASS,
    ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  const { rows } = await pg.query<{ id: string; name: string }>(
    'SELECT id, name FROM companies WHERE slug = $1 LIMIT 1',
    [SLUG],
  );
  if (rows.length === 0) { console.error(`Company "${SLUG}" not found.`); process.exit(1); }

  const { id: companyId, name: companyName } = rows[0]!;
  console.log(`Company: ${companyName} (${companyId})`);
  await pg.end();

  // ── MongoDB: replace recent snapshots with a clean contiguous incident ──────
  const mongo = new MongoClient(process.env.MONGODB_URI!);
  await mongo.connect();
  const col = mongo.db().collection(COLLECTION);

  // Step 1: delete all snapshots from the last 2 hours to remove interleaving
  const cutoff = new Date(Date.now() - TWO_HOURS);
  const { deletedCount } = await col.deleteMany({ slug: SLUG, fetchedAt: { $gte: cutoff } });
  console.log(`Deleted ${deletedCount} recent snapshots for "${SLUG}".`);

  // Step 2: insert clean contiguous block — minor escalating to major
  const now    = Date.now();
  const minute = 60 * 1000;

  const snapshots = [
    // 10 × minor (20 min ago → 11 min ago)
    ...Array.from({ length: 10 }, (_, i) => ({
      companyId, slug: SLUG,
      indicator:   'minor',
      description: 'Some components are experiencing degraded performance.',
      components:  [],
      fetchedAt:   new Date(now - (20 - i) * minute),
    })),
    // 8 × major (10 min ago → 3 min ago)
    ...Array.from({ length: 8 }, (_, i) => ({
      companyId, slug: SLUG,
      indicator:   'major',
      description: 'Multiple systems are experiencing a major disruption.',
      components:  [],
      fetchedAt:   new Date(now - (10 - i) * minute),
    })),
    // Final 'major' at NOW — this is what the poller will read as prev indicator
    {
      companyId, slug: SLUG,
      indicator:   'major',
      description: 'Multiple systems are experiencing a major disruption.',
      components:  [],
      fetchedAt:   new Date(now),
    },
  ];

  await col.insertMany(snapshots);
  console.log(`Inserted ${snapshots.length} fake snapshots (minor → major) for "${SLUG}".`);
  await mongo.close();

  // Step 3: clear Redis cache so poller reads our fake 'major' from MongoDB
  const redis = new Redis(process.env.REDIS_URL!);
  await redis.del(`snapshot:latest:${SLUG}`);
  await redis.del(`prediction:alerted:${SLUG}:elevated`);
  await redis.del(`prediction:alerted:${SLUG}:high`);
  console.log(`Cleared Redis cache for "${SLUG}".`);
  redis.disconnect();

  console.log('\nDone. The next poll (≤60s) will detect major → none and:');
  console.log('  • Generate + store a postmortem');
  console.log('  • Send postmortem + recovery emails to all watchers');
  console.log(`  • Show "Incident History" on /status/${SLUG}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
