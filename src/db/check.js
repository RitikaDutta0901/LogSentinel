import { query, closePool } from '../config/db.js';

const run = async () => {
  const extension = await query(
    "SELECT extversion FROM pg_extension WHERE extname = 'vector'",
  );

  if (!extension.rows[0]) {
    throw new Error(
      'pgvector is not installed. Install it, then run: npm run db:migrate',
    );
  }

  const column = await query(
    `SELECT format_type(atttypid, atttypmod) AS type
     FROM pg_attribute
     WHERE attrelid = 'logs'::regclass
       AND attname = 'embedding'
       AND NOT attisdropped`,
  );

  if (!column.rows[0]) {
    throw new Error('logs.embedding is missing. Run: npm run db:migrate');
  }

  if (column.rows[0].type !== 'vector(768)') {
    throw new Error(
      `logs.embedding has type ${column.rows[0].type}, expected vector(768). Run: npm run db:migrate`,
    );
  }

  const index = await query(
    `SELECT indexname
     FROM pg_indexes
     WHERE tablename = 'logs'
       AND indexname = 'idx_logs_embedding_hnsw'`,
  );

  if (!index.rows[0]) {
    throw new Error('HNSW index is missing. Run: npm run db:migrate');
  }

  const counts = await query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE log_level = 'ERROR')::int AS errors,
       COUNT(*) FILTER (WHERE embedding IS NOT NULL)::int AS embedded
     FROM logs`,
  );

  console.log(`[check] pgvector ${extension.rows[0].extversion} is installed`);
  console.log(`[check] logs.embedding type: ${column.rows[0].type}`);
  console.log(`[check] HNSW index: ${index.rows[0].indexname}`);
  console.log('[check] log counts:', counts.rows[0]);

  const missingEmbeddings = counts.rows[0].errors - counts.rows[0].embedded;
  if (missingEmbeddings > 0) {
    console.log(
      `[check] ${missingEmbeddings} ERROR log(s) need embeddings. Run: npm run db:backfill-embeddings`,
    );
  }
};

run()
  .catch((error) => {
    console.error('[check]', error.message);
    process.exitCode = 1;
  })
  .finally(() => closePool());
