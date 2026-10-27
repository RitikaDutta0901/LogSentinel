import { createApp } from './app.js';
import { env } from './config/env.js';
import { checkDatabaseConnection, closePool } from './config/db.js';

const app = createApp();
let server;

const start = async () => {
  try {
    await checkDatabaseConnection();
    console.log('[db] connected to PostgreSQL');
  } catch (error) {
    console.error('[db] Failed to connect to PostgreSQL:', error.message);
    process.exit(1);
  }

  server = app.listen(env.port, () => {
    console.log(`[server] LogSentinel API listening on http://localhost:${env.port} (${env.nodeEnv})`);
  });

  server.on('error', (error) => {
    console.error('[server] Failed to start:', error.message);
    process.exit(1);
  });
};

const shutdown = async (signal) => {
  console.log(`\n[server] ${signal} received, shutting down gracefully...`);

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }

  try {
    await closePool();
    console.log('[db] connection pool closed');
  } catch (error) {
    console.error('[db] Error while closing pool:', error.message);
  }

  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  console.error('[process] Unhandled rejection:', reason);
  shutdown('unhandledRejection');
});

start();
