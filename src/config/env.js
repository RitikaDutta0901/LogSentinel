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
};

if (Number.isNaN(env.port)) {
  throw new Error('Invalid PORT value: must be a number');
}
