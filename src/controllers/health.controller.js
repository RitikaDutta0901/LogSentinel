import { pool } from '../config/db.js';

export const getHealth = async (req, res) => {
  const startedAt = Date.now();

  try {
    await pool.query('SELECT 1');
    const latencyMs = Date.now() - startedAt;

    res.status(200).json({
      status: 'ok',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      database: {
        status: 'connected',
        latencyMs,
      },
    });
  } catch (error) {
    console.error('[health] Database check failed:', error.message);

    res.status(503).json({
      status: 'degraded',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      database: {
        status: 'disconnected',
      },
    });
  }
};
