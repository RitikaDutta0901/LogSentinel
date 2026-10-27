import 'dotenv/config';

const required = (name, fallback) => {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const parseBoolean = (value, fallback = false) => {
  if (value === undefined) return fallback;
  return value.toLowerCase() === 'true';
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number.parseInt(process.env.PORT ?? '4000', 10),
  databaseUrl: process.env.DATABASE_URL,
  db: {
    host: process.env.PGHOST ?? 'localhost',
    port: Number.parseInt(process.env.PGPORT ?? '5432', 10),
    user: required('PGUSER', 'postgres'),
    password: process.env.PGPASSWORD ?? '',
    database: required('PGDATABASE', 'logsentinel'),
    ssl: parseBoolean(process.env.PGSSL) ? { rejectUnauthorized: false } : false,
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? '',
    model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
    embeddingModel: process.env.GEMINI_EMBEDDING_MODEL ?? 'gemini-embedding-001',
    baseUrl: (process.env.GEMINI_API_BASE_URL ?? 'https://generativelanguage.googleapis.com').replace(
      /\/+$/,
      '',
    ),
    timeoutMs: Number.parseInt(process.env.GEMINI_TIMEOUT_MS ?? '30000', 10),
    embeddingTimeoutMs: Number.parseInt(
      process.env.GEMINI_EMBEDDING_TIMEOUT_MS ?? '10000',
      10,
    ),
  },
};

if (Number.isNaN(env.port)) {
  throw new Error('Invalid PORT value: must be a number');
}

if (Number.isNaN(env.gemini.timeoutMs) || env.gemini.timeoutMs < 1000) {
  throw new Error('Invalid GEMINI_TIMEOUT_MS value: must be at least 1000');
}

if (Number.isNaN(env.gemini.embeddingTimeoutMs) || env.gemini.embeddingTimeoutMs < 1000) {
  throw new Error('Invalid GEMINI_EMBEDDING_TIMEOUT_MS value: must be at least 1000');
}
