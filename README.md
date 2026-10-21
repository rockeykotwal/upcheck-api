# upcheck-api

> Know before your users do.

REST API powering [Upcheck](https://github.com/rockeykotwal/upcheck-web) — a real-time status aggregator that tracks whether popular services are up, degraded, or down. Polls 12 major services every 5 minutes, stores a full snapshot history, and exposes it via a clean JSON API with AI-powered incident summaries.

---

## How it works

```
Cron (every 5 min)
  └── Fetches each service's Atlassian Statuspage API
        ├── Writes snapshot → MongoDB (append-only history)
        └── Updates current status → Redis (5-min TTL cache)

GET /api/status        → reads Redis, falls back to MongoDB
GET /api/ai/summary/:slug → reads last 20 snapshots, sends to AI provider
```

**Tracked services:** GitHub · Stripe · Cloudflare · Discord · Vercel · Twilio · Datadog · Shopify · Netlify · npm · Fastly · PagerDuty

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22, TypeScript 5 |
| Framework | Express 4 |
| ORM | Drizzle ORM (node-postgres) |
| Relational DB | PostgreSQL — company registry |
| Document DB | MongoDB — snapshot + incident log |
| Cache | Redis — current status per service (TTL 5 min) |
| DI | tsyringe |
| Auth | JWT (jose) + argon2 |
| Validation | class-validator + class-transformer |
| AI | Ollama · Gemini · OpenAI · Claude (switchable via env) |
| Docs | Swagger UI at `/docs` |
| Tests | Vitest |

---

## Features

- **Live status polling** — hits Atlassian Statuspage-compatible APIs on a 5-minute cron
- **Full history** — every snapshot persisted in MongoDB; never overwrites
- **Redis cache** — current status served from memory, not disk
- **AI summaries** — ask any AI provider to summarize recent incidents for a service
- **Pluggable AI** — swap between Ollama, Gemini, OpenAI, or Claude with a single env var
- **Swagger docs** — full OpenAPI spec at `/docs`
- **Graceful shutdown** — drains HTTP, DB pool, Redis, and OTel tracing on SIGTERM

---

## Running locally

### With Docker (recommended)

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

| URL | What |
|---|---|
| `http://localhost:3000` | API |
| `http://localhost:3000/docs` | Swagger UI |
| `http://localhost:8025` | Mailpit (email preview) |

> If you have a local Postgres on port 5432, set `DB_PORT=5433` in `.env` before starting Docker.

### Without Docker

Requires PostgreSQL 16+, Redis 7+, and MongoDB 7+ installed locally.

```bash
git clone https://github.com/rockeykotwal/upcheck-api
cd upcheck-api
npm install
cp .env.example .env   # set DB_HOST, DB_USER, DB_PASS, REDIS_URL, MONGODB_URI
createdb upcheck
npm run db:migrate
npm run dev
```

### AI provider setup

Set `AI_PROVIDER` in `.env` to one of: `ollama` · `gemini` · `openai` · `claude`

For local dev, [Ollama](https://ollama.com) is free:
```bash
ollama pull llama3.2
# AI_PROVIDER=ollama in .env — no API key needed
```

---

## Production deployment

The API is containerised and ships as a single Docker image.

```bash
npm run build
docker build -t upcheck-api .
docker run -p 3000:3000 --env-file .env upcheck-api
```

For cloud deployment, a `task-definition.json` is included for **AWS ECS/Fargate**. Set all environment variables as ECS task secrets.

Minimum recommended: 0.5 vCPU · 512 MB RAM · Postgres 16 · Redis 7 · MongoDB 7

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Dev server with watch mode |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm run start` | Run compiled build |
| `npm run test` | Vitest |
| `npm run test:coverage` | Vitest with coverage |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate Drizzle migration from schema changes |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run db:seed:rbac` | Seed default roles and permissions |

---

## Environment variables

Copy `.env.example` to `.env`. All variables are validated at startup — the server refuses to boot if required vars are missing.

| Variable | Required | Description |
|---|---|---|
| `DB_HOST` | Yes | Postgres host |
| `DB_NAME` | Yes | Postgres database name |
| `DB_USER` | Yes | Postgres user |
| `DB_PASS` | Yes | Postgres password |
| `DB_PORT` | No | Postgres port (default `5432`; use `5433` if Docker conflicts) |
| `REDIS_URL` | Yes | Redis connection string |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Min 32 chars — generate: `openssl rand -base64 32` |
| `AI_PROVIDER` | No | `ollama` · `gemini` · `openai` · `claude` (default: `ollama`) |
| `OLLAMA_BASE_URL` | No | Ollama host (default: `http://localhost:11434`) |
| `OLLAMA_MODEL` | No | Ollama model (default: `llama3.2`) |
| `GEMINI_API_KEY` | No | Required if `AI_PROVIDER=gemini` |
| `OPENAI_API_KEY` | No | Required if `AI_PROVIDER=openai` |
| `CLAUDE_API_KEY` | No | Required if `AI_PROVIDER=claude` |

---

## Related

- [upcheck-web](https://github.com/rockeykotwal/upcheck-web) — React frontend
