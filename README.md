# upcheck-api

Backend for [Upcheck](https://github.com/rockeykotwal/upcheck-web) — a live service status aggregator that shows whether popular services (GitHub, Stripe, Cloudflare, etc.) are up or down.

**Stack:** Express · TypeScript · Drizzle ORM · PostgreSQL · Redis · MongoDB · Node.js 22

---

## Local Development

### Option A — With Docker (recommended)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop).

```bash
git clone https://github.com/rockeykotwal/upcheck-api
cd upcheck-api
npm install
cp .env.example .env
docker compose up -d postgres redis mongodb mailpit
npm run db:migrate
npm run dev
```

| URL | Description |
|---|---|
| `http://localhost:3000` | API |
| `http://localhost:3000/docs` | Swagger UI |
| `http://localhost:8025` | Mailpit (email preview) |

> **Port conflict:** If you have a local Postgres on port 5432, set `DB_PORT=5433` in `.env` before starting Docker.

---

### Option B — Without Docker

Requires PostgreSQL 16+, Redis 7+, and MongoDB 7+ installed and running locally.

```bash
git clone https://github.com/rockeykotwal/upcheck-api
cd upcheck-api
npm install
cp .env.example .env   # update DB_HOST, DB_USER, DB_PASS, REDIS_URL, MONGODB_URI
createdb upcheck
npm run db:migrate
npm run dev
```

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server (watch mode) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run test` | Run Vitest |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate migration from schema changes |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Open Drizzle Studio |

---

## Environment Variables

Copy `.env.example` to `.env`. Key variables:

| Variable | Description |
|---|---|
| `DB_PORT` | Postgres port — use `5433` if Docker conflicts with local Postgres |
| `JWT_SECRET` | Min 32 chars — generate: `openssl rand -base64 32` |
| `REDIS_URL` | Redis connection string |
| `MONGODB_URI` | MongoDB connection string |
