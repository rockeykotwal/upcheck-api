import * as dotenv from 'dotenv';
import { AppError } from '../errors/AppError';

dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: "${key}"`);
  }
  return value;
}

function requireSecret(key: string, minLength: number): string {
  const value = process.env[key];
  if (value === undefined || value === '') {
    throw new AppError(`Missing required environment variable: "${key}"`, 500, false);
  }
  if (value.length < minLength) {
    throw new AppError(
      `Environment variable "${key}" must be at least ${minLength} characters`,
      500,
      false,
    );
  }
  return value;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function envInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined) return fallback;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) {
    throw new Error(`Environment variable "${key}" must be an integer, got: "${raw}"`);
  }
  return n;
}

export const config = {
  app: {
    port: envInt('PORT', envInt('APP_PORT', 3000)),
    env:          optionalEnv('NODE_ENV', 'development'),
    isProduction: optionalEnv('NODE_ENV', 'development') === 'production',
    name:         optionalEnv('APP_NAME', 'App'),
    frontendUrl:  optionalEnv('FRONTEND_URL', 'http://localhost:5173'),
  },
  db: {
    host: requireEnv('DB_HOST'),
    port: envInt('DB_PORT', 5432),
    name: requireEnv('DB_NAME'),
    user: requireEnv('DB_USER'),
    pass: requireEnv('DB_PASS'),
    poolMin: envInt('DB_POOL_MIN', 2),
    poolMax: envInt('DB_POOL_MAX', 10),
    ssl: optionalEnv('DB_SSL', 'false') === 'true',
  },
  redis: {
    url: requireEnv('REDIS_URL'),
  },
  mongo: {
    uri:     requireEnv('MONGODB_URI'),
    poolMin: envInt('MONGODB_POOL_MIN', 2),
    poolMax: envInt('MONGODB_POOL_MAX', 10),
  },
  otel: {
    serviceName: optionalEnv('OTEL_SERVICE_NAME', 'express-app'),
    exporterEndpoint: optionalEnv('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://localhost:4318'),
  },
  jwt: {
    secret:           requireSecret('JWT_SECRET', 32),
    accessExpiresIn:  optionalEnv('JWT_ACCESS_EXPIRES_IN', '15m'),
    refreshExpiresIn: optionalEnv('JWT_REFRESH_EXPIRES_IN', '7d'),
  },
  auth: {
    requireEmailVerification: optionalEnv('REQUIRE_EMAIL_VERIFICATION', 'true') !== 'false',
  },
  ai: {
    provider: optionalEnv('AI_PROVIDER', 'ollama') as 'ollama' | 'gemini' | 'openai' | 'claude',
    ollama: {
      baseUrl: optionalEnv('OLLAMA_BASE_URL', 'http://localhost:11434'),
      model:   optionalEnv('OLLAMA_MODEL', 'llama3'),
    },
    gemini: {
      apiKey: optionalEnv('GEMINI_API_KEY', ''),
      model:  optionalEnv('GEMINI_MODEL', 'gemini-1.5-flash'),
    },
    openai: {
      apiKey: optionalEnv('OPENAI_API_KEY', ''),
      model:  optionalEnv('OPENAI_MODEL', 'gpt-4o-mini'),
    },
    claude: {
      apiKey: optionalEnv('CLAUDE_API_KEY', ''),
      model:  optionalEnv('CLAUDE_MODEL', 'claude-haiku-4-5-20251001'),
    },
  },
  admin: {
    apiKey: optionalEnv('ADMIN_API_KEY', ''),
  },
  email: {
    provider:    optionalEnv('EMAIL_PROVIDER', 'smtp') as 'smtp' | 'resend',
    from:        optionalEnv('EMAIL_FROM', 'noreply@example.com'),
    fromName:    optionalEnv('EMAIL_FROM_NAME', 'App'),
    smtp: {
      host:   optionalEnv('SMTP_HOST', 'localhost'),
      port:   envInt('SMTP_PORT', 587),
      secure: optionalEnv('SMTP_SECURE', 'false') === 'true',
      user:   optionalEnv('SMTP_USER', ''),
      pass:   optionalEnv('SMTP_PASS', ''),
    },
    resendApiKey: optionalEnv('RESEND_API_KEY', ''),
  },
} as const;

export type Config = typeof config;
