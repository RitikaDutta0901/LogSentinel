import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

const poolConfig = env.databaseUrl
  ? { connectionString: env.databaseUrl, ssl: env.db.ssl }
  : {
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.database,
      ssl: env.db.ssl,
    };

export const pool = new Pool({
  ...poolConfig,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  application_name: 'logsentinel-api',
});

pool.on('error', (error) => {
  console.error('[db] Unexpected idle client error:', error.message);
});

export const query = (text, params) => pool.query(text, params);

export const checkDatabaseConnection = async () => {
  const result = await pool.query('SELECT 1 AS ok');
  return result.rows[0]?.ok === 1;
};

export const closePool = () => pool.end();
