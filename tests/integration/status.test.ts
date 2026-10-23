/**
 * Integration tests — Status routes
 *
 * Requires running PostgreSQL + Redis + MongoDB.
 *
 * Run locally:
 *   docker-compose up postgres redis mongo -d
 *   npm run db:migrate
 *   npm test
 */

import 'reflect-metadata';
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import type { Application } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../../src/database/client';
import { expressLoader } from '../../src/loaders/expressLoader';
import { mongoLoader } from '../../src/loaders/mongoLoader';

let app: Application;

const testSlug    = 'test-status-co';
const testSlug2   = 'test-status-co-2';

beforeAll(async () => {
  await mongoLoader();
  app = expressLoader();
});

afterAll(async () => {
  await new Promise((r) => setTimeout(r, 200));
});

beforeEach(async () => {
  try {
    await db.execute(sql`
      DELETE FROM companies WHERE slug IN (${testSlug}, ${testSlug2})
    `);
  } catch {
    // Skip if DB unavailable
  }
});

async function seedCompany(slug: string, name: string) {
  await db.execute(sql`
    INSERT INTO companies (name, slug, status_page_url)
    VALUES (${name}, ${slug}, ${'https://status.example.com'})
    ON CONFLICT (slug) DO NOTHING
  `);
}

describe('GET /api/status', () => {
  it('200 — returns statuses array', async () => {
    const res = await request(app).get('/api/status');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('statuses');
    expect(Array.isArray(res.body.statuses)).toBe(true);
  }, 15000);

  it('200 — each item has company and current fields', async () => {
    await seedCompany(testSlug, 'Test Status Co');

    const res = await request(app).get('/api/status');

    expect(res.status).toBe(200);
    const item = (res.body.statuses as Array<{ company: { slug: string }; current: unknown }>)
      .find((s) => s.company.slug === testSlug);

    expect(item).toBeDefined();
    expect(item).toHaveProperty('company');
    expect(item).toHaveProperty('current');
  });
});

describe('GET /api/status/search', () => {
  it('400 — missing q param', async () => {
    const res = await request(app).get('/api/status/search');
    expect(res.status).toBe(400);
  });

  it('400 — empty q param', async () => {
    const res = await request(app).get('/api/status/search?q=');
    expect(res.status).toBe(400);
  });

  it('200 — returns matching companies', async () => {
    await seedCompany(testSlug, 'Test Status Co');

    const res = await request(app).get(`/api/status/search?q=test-status`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.statuses)).toBe(true);
    const found = (res.body.statuses as Array<{ company: { slug: string } }>)
      .find((s) => s.company.slug === testSlug);
    expect(found).toBeDefined();
  });

  it('200 — returns empty array when no match', async () => {
    const res = await request(app).get('/api/status/search?q=zzz-no-match-xyz');

    expect(res.status).toBe(200);
    expect(res.body.statuses).toHaveLength(0);
  });
});

describe('GET /api/status/:slug', () => {
  it('404 — unknown slug', async () => {
    const res = await request(app).get('/api/status/this-slug-does-not-exist-xyz');
    expect(res.status).toBe(404);
  });

  it('200 — returns company detail with history', async () => {
    await seedCompany(testSlug, 'Test Status Co');

    const res = await request(app).get(`/api/status/${testSlug}`);

    expect(res.status).toBe(200);
    expect(res.body.company.slug).toBe(testSlug);
    expect(res.body).toHaveProperty('current');
    expect(Array.isArray(res.body.history)).toBe(true);
  });
});
