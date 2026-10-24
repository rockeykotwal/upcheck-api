# upcheck-api

> Know before your users do.

REST API powering [Upcheck](https://github.com/rockeykotwal/upcheck-web) — a real-time service status aggregator. Polls 51+ services every 60 seconds, stores full snapshot history, sends intelligent email alerts, and generates AI-powered incident summaries and postmortems.

---

## How it works

```
Poller (every 60s — setInterval or external cron)
  └── Fetches each service's status
        ├── Statuspage.io API  → for seeded services (GitHub, Stripe, etc.)
        └── HTTP GET check     → for user-added custom monitors
              ├── Saves snapshot → MongoDB (append-only history)
              ├── Alerts watchers if status changed (email)
              ├── Prediction agent — scores risk, warns watchers if elevated/high
              └── Postmortem generator — fires on recovery, generates AI summary
```

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22, TypeScript 5 |
| Framework | Express 4 |
| ORM | Drizzle ORM (node-postgres) |
| Relational DB | PostgreSQL — users, companies, watchlist |
| Document DB | MongoDB — snapshots, incident log, postmortems |
| Cache | Redis — current status per service, dedup keys |
| DI | tsyringe |
| Auth | JWT (jose) + argon2 |
| Validation | class-validator + class-transformer |
| Email | SMTP (Brevo) or Resend — switchable via env |
| AI | Gemini · OpenAI · Claude · Ollama (switchable via env) |
| Docs | Swagger UI at `/docs` |
| Tests | Vitest (119 tests) |

---

## Features

- **Live status polling** — 60-second interval, 51+ seeded services + user-added custom URLs
- **Custom monitors** — authenticated users can add any public URL to monitor (HTTP GET check)
- **Watchlist** — users subscribe to services; alerts fire on status changes
- **AI incident summaries** — on-demand AI analysis of recent snapshots; 1-click send to all watchers
- **Prediction agent** — scores escalation/severity patterns after every poll; emails watchers at elevated/high risk
- **Postmortem generator** — auto-fires on service recovery; generates 3–4 sentence AI postmortem and emails watchers
- **Pluggable AI** — swap between Gemini, OpenAI, Claude, or Ollama with a single env var
- **Pluggable email** — Brevo SMTP (recommended, 300/day free) or Resend
- **Full snapshot history** — every poll persisted in MongoDB; uptime stats (24h, 7d, 30d)
- **Swagger docs** — full OpenAPI spec at `/docs`
- **Graceful shutdown** — drains HTTP, DB pool, Redis, and OTel on SIGTERM

---

## Running locally

```bash
git clone https://github.com/rockeykotwal/upcheck-api
cd upcheck-api
npm install
cp .env.example .env   # fill in required vars (see below)
npm run db:migrate
npm run dev
```

| URL | What |
|---|---|
| `http://localhost:3000` | API |
| `http://localhost:3000/docs` | Swagger UI |

> Docker Compose is included for running Postgres, Redis, and MongoDB locally if you don't have them installed.

### AI provider setup

Set `AI_PROVIDER` in `.env` to one of: `gemini` · `openai` · `claude` · `ollama`

For local dev, [Ollama](https://ollama.com) is free and runs fully offline:
```bash
ollama pull llama3.2
# set AI_PROVIDER=ollama in .env — no API key needed
```

---

## Email setup — Brevo (recommended)

[Brevo](https://brevo.com) offers **300 emails/day free** with no domain required — just an account.

1. Sign up at brevo.com
2. Go to **SMTP & API → SMTP** tab to get your credentials
3. Add your sender email under **Senders & IPs → Senders** (Brevo sends a verification email)
4. Set in `.env`:

```env
EMAIL_PROVIDER=smtp
EMAIL_FROM=your-verified-sender@email.com
EMAIL_FROM_NAME=Upcheck
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-brevo-login@email.com
SMTP_PASS=your-brevo-smtp-key
```

> Alternatively, set `EMAIL_PROVIDER=resend` and provide `RESEND_API_KEY` if you have a verified domain on [Resend](https://resend.com).

---

## Polling on serverless — cron-job.org

The built-in `setInterval` poller runs automatically on any persistent server (Railway, Render, ECS, etc.).

For **Vercel** or other serverless platforms where the process sleeps between requests, use an external cron to trigger polling:

1. Sign up free at [console.cron-job.org](https://console.cron-job.org/jobs)
2. Create a new job:
   - **URL:** `https://your-api-domain.com/api/admin/poll`
   - **Method:** `POST`
   - **Schedule:** every 1 minute
   - **Header:** `X-Admin-Key: <your ADMIN_API_KEY>`
3. Enable the job — done

The endpoint runs the full poll cycle: fetches all services, saves snapshots, fires alerts, runs prediction and postmortem logic.

---

## Production deployment

The API needs a **persistent server** for the built-in poller to run. Recommended options:

| Platform | Free tier | Notes |
|---|---|---|
| **Railway** | Hobby $5/mo | Easiest — Docker deploy, env vars in dashboard |
| **Render** | $7/mo (paid) | Free tier sleeps after inactivity |
| **Fly.io** | Free (3 VMs) | More setup, genuinely free |
| **AWS ECS/Fargate** | Pay-per-use | `task-definition.json` included |

> If deploying to Vercel (serverless), remove the `setInterval` poller and use cron-job.org instead (see above).

Minimum recommended: 0.5 vCPU · 512 MB RAM

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Dev server with watch mode |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm run start` | Run compiled build |
| `npm run test` | Vitest (119 tests) |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate Drizzle migration from schema changes |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run db:seed:rbac` | Seed default roles and permissions |

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DB_HOST` | Yes | PostgreSQL host |
| `DB_NAME` | Yes | PostgreSQL database name |
| `DB_USER` | Yes | PostgreSQL user |
| `DB_PASS` | Yes | PostgreSQL password |
| `DB_SSL` | No | `true` for Neon/cloud Postgres |
| `REDIS_URL` | Yes | Redis connection string |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Min 32 chars — `openssl rand -base64 32` |
| `ADMIN_API_KEY` | Yes | Protects `/api/admin/*` routes |
| `EMAIL_PROVIDER` | No | `smtp` (default) · `resend` · `console` |
| `EMAIL_FROM` | No | Verified sender email address |
| `SMTP_HOST` | No | SMTP host (e.g. `smtp-relay.brevo.com`) |
| `SMTP_PORT` | No | SMTP port (default `587`) |
| `SMTP_USER` | No | SMTP login |
| `SMTP_PASS` | No | SMTP password / key |
| `RESEND_API_KEY` | No | Required if `EMAIL_PROVIDER=resend` |
| `AI_PROVIDER` | No | `gemini` · `openai` · `claude` · `ollama` (default) |
| `GEMINI_API_KEY` | No | Required if `AI_PROVIDER=gemini` |
| `OPENAI_API_KEY` | No | Required if `AI_PROVIDER=openai` |
| `CLAUDE_API_KEY` | No | Required if `AI_PROVIDER=claude` |
| `FRONTEND_URL` | No | Frontend origin for CORS + email links |

---

## Related

- [upcheck-web](https://github.com/rockeykotwal/upcheck-web) — React frontend
