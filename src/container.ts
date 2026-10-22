import 'reflect-metadata';
import { container } from 'tsyringe';
import { db } from './database/client';
import { redisClient } from './cache/redis';
import { config } from './config';
import { SmtpProvider }  from './modules/email/providers/SmtpProvider';
import { ResendProvider } from './modules/email/providers/ResendProvider';
import { EmailService }  from './modules/email/services/EmailService';
import { CompanyRepository }    from './modules/status/repositories/CompanyRepository';
import { StatusFetcherService } from './modules/status/services/StatusFetcherService';
import { SnapshotRepository }    from './modules/status/repositories/SnapshotRepository';
import { StatusPollerService }   from './modules/status/services/StatusPollerService';
import { StatusService }         from './modules/status/services/StatusService';
import { OllamaProvider }        from './modules/ai/providers/OllamaProvider';
import { GeminiProvider }        from './modules/ai/providers/GeminiProvider';
import { OpenAiProvider }        from './modules/ai/providers/OpenAiProvider';
import { AiService }             from './modules/ai/services/AiService';
import { ClaudeProvider }        from './modules/ai/providers/ClaudeProvider';
import { AdminService }          from './modules/admin/services/AdminService';
import { WatchlistRepository }  from './modules/watchlist/repositories/WatchlistRepository';
import { WatchlistService }     from './modules/watchlist/services/WatchlistService';
import { UserRepository }       from './modules/users/repositories/UserRepository';
import { AlertService }         from './modules/alert/services/AlertService';
import { TOKENS } from './tokens';

// Re-export so existing imports of TOKENS from this file continue to work
export { TOKENS } from './tokens';

// ── Infrastructure instances ──────────────────────────────────────────────────
// MongoDb is registered by mongoLoader() after a verified connection.
container.registerInstance(TOKENS.DrizzleDb,   db);
container.registerInstance(TOKENS.RedisClient, redisClient);

// ── Email provider — chosen at startup from EMAIL_PROVIDER env var ─────────
if (config.email.provider === 'resend') {
  container.register(TOKENS.EmailProvider, { useClass: ResendProvider });
} else {
  container.register(TOKENS.EmailProvider, { useClass: SmtpProvider });
}
container.registerSingleton(TOKENS.EmailService, EmailService);

// ── Status module ─────────────────────────────────────────────────────────────
container.registerSingleton(TOKENS.CompanyRepository,    CompanyRepository);
container.registerSingleton(TOKENS.StatusFetcherService, StatusFetcherService);
container.registerSingleton(TOKENS.SnapshotRepository,   SnapshotRepository);
container.registerSingleton(TOKENS.StatusPollerService,  StatusPollerService);
container.registerSingleton(TOKENS.StatusService,        StatusService);

// ── AI module ─────────────────────────────────────────────────────────────────
if (config.ai.provider === 'gemini') {
  container.register(TOKENS.AiProvider, { useClass: GeminiProvider });
} else if (config.ai.provider === 'openai') {
  container.register(TOKENS.AiProvider, { useClass: OpenAiProvider });
} else if (config.ai.provider === 'claude') {
  container.register(TOKENS.AiProvider, { useClass: ClaudeProvider });
} else {
  container.register(TOKENS.AiProvider, { useClass: OllamaProvider });
}
container.registerSingleton(TOKENS.AiService, AiService);

// ── Admin module ──────────────────────────────────────────────────────────────
container.registerSingleton(TOKENS.AdminService, AdminService);

// ── Watchlist module ──────────────────────────────────────────────────────────
container.registerSingleton(TOKENS.WatchlistRepository, WatchlistRepository);
container.registerSingleton(TOKENS.WatchlistService,    WatchlistService);

// ── Users ─────────────────────────────────────────────────────────────────────
container.registerSingleton(TOKENS.UserRepository, UserRepository);

// ── Alert module ──────────────────────────────────────────────────────────────
container.registerSingleton(TOKENS.AlertService, AlertService);

export { container };
