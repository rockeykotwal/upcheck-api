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
  // Developer Tools
  { name: 'GitHub',        slug: 'github',        statusPageUrl: 'https://www.githubstatus.com',          category: 'developer-tools' },
  { name: 'GitLab',        slug: 'gitlab',        statusPageUrl: 'https://status.gitlab.com',              category: 'developer-tools' },
  { name: 'npm',           slug: 'npm',           statusPageUrl: 'https://status.npmjs.org',               category: 'developer-tools' },
  { name: 'CircleCI',      slug: 'circleci',      statusPageUrl: 'https://status.circleci.com',            category: 'developer-tools' },
  { name: 'Sentry',        slug: 'sentry',        statusPageUrl: 'https://status.sentry.io',               category: 'developer-tools' },
  { name: 'Atlassian',     slug: 'atlassian',     statusPageUrl: 'https://status.atlassian.com',           category: 'developer-tools' },

  // Hosting
  { name: 'Vercel',        slug: 'vercel',        statusPageUrl: 'https://www.vercel-status.com',          category: 'hosting'         },
  { name: 'Netlify',       slug: 'netlify',       statusPageUrl: 'https://netlifystatus.com',              category: 'hosting'         },
  { name: 'Heroku',        slug: 'heroku',        statusPageUrl: 'https://status.heroku.com',              category: 'hosting'         },
  { name: 'DigitalOcean',  slug: 'digitalocean',  statusPageUrl: 'https://status.digitalocean.com',        category: 'hosting'         },
  { name: 'Render',        slug: 'render',        statusPageUrl: 'https://status.render.com',              category: 'hosting'         },

  // Payments
  { name: 'Stripe',        slug: 'stripe',        statusPageUrl: 'https://status.stripe.com',              category: 'payments'        },

  // CDN
  { name: 'Cloudflare',    slug: 'cloudflare',    statusPageUrl: 'https://www.cloudflarestatus.com',       category: 'cdn'             },
  { name: 'Fastly',        slug: 'fastly',        statusPageUrl: 'https://status.fastly.com',              category: 'cdn'             },

  // Communication
  { name: 'Discord',       slug: 'discord',       statusPageUrl: 'https://discordstatus.com',              category: 'communication'   },
  { name: 'Twilio',        slug: 'twilio',        statusPageUrl: 'https://status.twilio.com',              category: 'communication'   },
  { name: 'SendGrid',      slug: 'sendgrid',      statusPageUrl: 'https://status.sendgrid.com',            category: 'communication'   },

  // Monitoring
  { name: 'Datadog',       slug: 'datadog',       statusPageUrl: 'https://status.datadoghq.com',           category: 'monitoring'      },
  { name: 'PagerDuty',     slug: 'pagerduty',     statusPageUrl: 'https://status.pagerduty.com',           category: 'monitoring'      },
  { name: 'New Relic',     slug: 'new-relic',     statusPageUrl: 'https://status.newrelic.com',            category: 'monitoring'      },

  // Database
  { name: 'MongoDB Atlas', slug: 'mongodb-atlas', statusPageUrl: 'https://status.mongodb.com',             category: 'database'        },
  { name: 'Supabase',      slug: 'supabase',      statusPageUrl: 'https://status.supabase.com',            category: 'database'        },

  // Auth
  { name: 'Auth0',         slug: 'auth0',         statusPageUrl: 'https://status.auth0.com',               category: 'auth'            },

  // Ecommerce
  { name: 'Shopify',       slug: 'shopify',       statusPageUrl: 'https://www.shopifystatus.com',          category: 'ecommerce'       },
];

async function seed() {
  process.stdout.write('Seeding companies...\n');

  await db
    .insert(companiesTable)
    .values(companies)
    .onConflictDoNothing({ target: companiesTable.slug });

  process.stdout.write(`✓ ${companies.length} companies seeded\n`);
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
