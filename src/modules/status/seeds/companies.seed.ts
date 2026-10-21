import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { companiesTable } from '../models/company.schema';

dotenv.config();

const pool = new Pool({
  host:     process.env.DB_HOST     ?? 'localhost',
  port:     Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME     ?? 'upcheck',
  user:     process.env.DB_USER     ?? 'postgres',
  password: process.env.DB_PASS     ?? 'postgres',
});

const db = drizzle(pool);

const companies = [
  { name: 'GitHub',     slug: 'github',     statusPageUrl: 'https://www.githubstatus.com',      category: 'developer-tools' },
  { name: 'Stripe',     slug: 'stripe',     statusPageUrl: 'https://status.stripe.com',          category: 'payments'        },
  { name: 'Cloudflare', slug: 'cloudflare', statusPageUrl: 'https://www.cloudflarestatus.com',   category: 'cdn'             },
  { name: 'Discord',    slug: 'discord',    statusPageUrl: 'https://discordstatus.com',           category: 'communication'   },
  { name: 'Vercel',     slug: 'vercel',     statusPageUrl: 'https://www.vercel-status.com',       category: 'hosting'         },
  { name: 'Twilio',     slug: 'twilio',     statusPageUrl: 'https://status.twilio.com',           category: 'communication'   },
  { name: 'Datadog',    slug: 'datadog',    statusPageUrl: 'https://status.datadoghq.com',        category: 'monitoring'      },
  { name: 'Shopify',    slug: 'shopify',    statusPageUrl: 'https://www.shopifystatus.com',       category: 'ecommerce'       },
  { name: 'Netlify',    slug: 'netlify',    statusPageUrl: 'https://netlifystatus.com',           category: 'hosting'         },
  { name: 'npm',        slug: 'npm',        statusPageUrl: 'https://status.npmjs.org',            category: 'developer-tools' },
  { name: 'Fastly',     slug: 'fastly',     statusPageUrl: 'https://status.fastly.com',           category: 'cdn'             },
  { name: 'PagerDuty',  slug: 'pagerduty',  statusPageUrl: 'https://status.pagerduty.com',        category: 'monitoring'      },
];

async function seed() {
  console.log('Seeding companies...');

  await db
    .insert(companiesTable)
    .values(companies)
    .onConflictDoNothing({ target: companiesTable.slug });

  console.log(`✓ ${companies.length} companies seeded`);
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
