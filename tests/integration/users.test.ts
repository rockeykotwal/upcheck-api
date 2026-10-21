/**
 * Integration tests — User routes
 *
 * Requires running PostgreSQL + Redis.
 */

import 'reflect-metadata';
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import type { Application } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../../src/database/client';
import { expressLoader } from '../../src/loaders/expressLoader';

let app: Application;

beforeAll(async () => {
  app = expressLoader();
});

afterAll(async () => {
  await new Promise((r) => setTimeout(r, 200));
});

beforeEach(async () => {
  try {
    await db.execute(sql`DELETE FROM users WHERE email IN ('me@example.com')`);
  } catch {
    // Skip if DB unavailable
  }
});

function getAuthHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

describe('GET /api/users/me', () => {
  it('200 — returns the currently authenticated user', async () => {
    const signup = await request(app).post('/api/auth/signup').send({
      firstName: 'Me', lastName: 'User', email: 'me@example.com', password: 'password123',
    });

    const { accessToken, user } = signup.body as { accessToken: string; user: { id: string } };

    const res = await request(app)
      .get('/api/users/me')
      .set(getAuthHeader(accessToken));

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('401 — rejects unauthenticated request', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
  });
});
