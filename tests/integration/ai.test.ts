/**
 * Integration tests — AI routes
 *
 * These tests verify route wiring only.
 * The 404 case exercises the full stack without hitting any external AI API.
 *
 * Requires running PostgreSQL + Redis + MongoDB.
 */

import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Application } from 'express';
import { expressLoader } from '../../src/loaders/expressLoader';
import { mongoLoader } from '../../src/loaders/mongoLoader';

let app: Application;

beforeAll(async () => {
  await mongoLoader();
  app = expressLoader();
});

afterAll(async () => {
  await new Promise((r) => setTimeout(r, 200));
});

describe('GET /api/ai/summary/:slug', () => {
  it('404 — returns error for slug with no snapshot data', async () => {
    const res = await request(app).get('/api/ai/summary/zzz-this-slug-does-not-exist-xyz');

    expect(res.status).toBe(404);
  });
});
