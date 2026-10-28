import { query } from '../config/db.js';

const COLUMNS = '(timestamp, service_name, log_level, message, metadata, embedding)';

export const insertLogs = async (logs) => {
  if (!Array.isArray(logs) || logs.length === 0) return 0;

  const values = [];
  const placeholders = logs.map((log, index) => {
    const offset = index * 6;
    values.push(
      log.timestamp ?? null,
      log.serviceName,
      log.logLevel,
      log.message,
      JSON.stringify(log.metadata ?? {}),
      Array.isArray(log.embedding) ? JSON.stringify(log.embedding) : null,
    );

    return `(COALESCE($${offset + 1}::timestamptz, NOW()), $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}::jsonb, $${offset + 6}::vector)`;
  });

  await query(`INSERT INTO logs ${COLUMNS} VALUES ${placeholders.join(', ')}`, values);

  return logs.length;
};

const buildWhereClause = ({ since, level, serviceName, search }) => {
  const conditions = [];
  const params = [];

  if (since) {
    params.push(since);
    conditions.push(`timestamp >= $${params.length}`);
  }

  if (level) {
    params.push(level);
    conditions.push(`log_level = $${params.length}`);
  }

  if (serviceName) {
    params.push(serviceName);
    conditions.push(`service_name = $${params.length}`);
  }

  if (search) {
    params.push(search);
    conditions.push(
      `to_tsvector('english', message) @@ plainto_tsquery('english', $${params.length})`,
    );
  }

  return {
    where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
};

export const searchLogs = async ({ page, limit, offset, ...filters }) => {
  const { where, params } = buildWhereClause(filters);

  const dataParams = [...params, limit, offset];
  const limitParam = `$${params.length + 1}`;
  const offsetParam = `$${params.length + 2}`;

  const [dataResult, countResult] = await Promise.all([
    query(
      `SELECT id, timestamp, service_name, log_level, message, metadata
       FROM logs
       ${where}
       ORDER BY timestamp DESC, id DESC
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      dataParams,
    ),
    query(`SELECT COUNT(*)::bigint AS total FROM logs ${where}`, params),
  ]);

  return {
    logs: dataResult.rows,
    total: Number(countResult.rows[0].total),
  };
};

export const findSimilarErrorLogs = async (embedding, limit = 5) => {
  const safeLimit = Math.min(Math.max(limit, 1), 20);
  const vector = JSON.stringify(embedding);

  const result = await query(
    `SELECT
       id,
       timestamp,
       service_name,
       log_level,
       message,
       metadata,
       1 - (embedding <=> $1::vector) AS similarity
     FROM logs
     WHERE log_level = 'ERROR' AND embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [vector, safeLimit],
  );

  return result.rows;
};

export const findErrorLogsMissingEmbeddings = async (limit = 50) => {
  const safeLimit = Math.min(Math.max(limit, 1), 500);

  const result = await query(
    `SELECT id, message
     FROM logs
     WHERE log_level = 'ERROR' AND embedding IS NULL
     ORDER BY timestamp ASC, id ASC
     LIMIT $1`,
    [safeLimit],
  );

  return result.rows;
};

export const updateLogEmbeddings = async (items) => {
  if (!Array.isArray(items) || items.length === 0) return 0;

  const values = [];
  const placeholders = items.map((item, index) => {
    const offset = index * 2;
    values.push(item.id, JSON.stringify(item.embedding));
    return `($${offset + 1}::uuid, $${offset + 2}::vector)`;
  });

  await query(
    `UPDATE logs AS target
     SET embedding = data.embedding
     FROM (VALUES ${placeholders.join(', ')}) AS data(id, embedding)
     WHERE target.id = data.id`,
    values,
  );

  return items.length;
};

export const getRecentErrorLogs = async (limit = 20) => {
  const result = await query(
    `SELECT id, timestamp, service_name, log_level, message, metadata
     FROM logs
     WHERE log_level = 'ERROR'
     ORDER BY timestamp DESC, id DESC
     LIMIT $1`,
    [limit],
  );

  return result.rows;
};

export const listServices = async () => {
  const result = await query(
    `SELECT DISTINCT service_name FROM logs ORDER BY service_name ASC`,
  );

  return result.rows.map((row) => row.service_name);
};

const BUCKET_RULES = [
  { maxRangeMs: 60 * 60 * 1000, seconds: 5 * 60 },
  { maxRangeMs: 6 * 60 * 60 * 1000, seconds: 15 * 60 },
  { maxRangeMs: 24 * 60 * 60 * 1000, seconds: 60 * 60 },
  { maxRangeMs: 7 * 24 * 60 * 60 * 1000, seconds: 6 * 60 * 60 },
  { maxRangeMs: 30 * 24 * 60 * 60 * 1000, seconds: 24 * 60 * 60 },
];

const getBucketSeconds = (since) => {
  if (!since) return 24 * 60 * 60;

  const rangeMs = Date.now() - since.getTime();
  const rule = BUCKET_RULES.find((item) => rangeMs <= item.maxRangeMs);

  return rule ? rule.seconds : 24 * 60 * 60;
};

export const getErrorStats = async ({ since, serviceName, search }) => {
  const intervalSeconds = getBucketSeconds(since);
  const params = [intervalSeconds];
  const conditions = [`log_level = 'ERROR'`];

  if (since) {
    params.push(since);
    conditions.push(`timestamp >= $${params.length}`);
  }

  if (serviceName) {
    params.push(serviceName);
    conditions.push(`service_name = $${params.length}`);
  }

  if (search) {
    params.push(search);
    conditions.push(`to_tsvector('english', message) @@ plainto_tsquery('english', $${params.length})`);
  }

  const result = await query(
    `SELECT
       date_bin(make_interval(secs => $1), timestamp, '1970-01-01T00:00:00Z'::timestamptz) AS bucket,
       COUNT(*)::int AS count
     FROM logs
     WHERE ${conditions.join(' AND ')}
     GROUP BY bucket
     ORDER BY bucket ASC`,
    params,
  );

  return {
    intervalSeconds,
    since: since ? since.toISOString() : null,
    buckets: result.rows,
  };
};
