import { checkDatabaseConnection, closePool } from '../config/db.js';
import { env } from '../config/env.js';
import {
  findErrorLogsMissingEmbeddings,
  updateLogEmbeddings,
} from '../repositories/log.repository.js';
import { embedTexts } from '../services/embedding.service.js';

const BATCH_SIZE = 50;

const run = async () => {
  if (!env.gemini.apiKey) {
    throw new Error('GEMINI_API_KEY is required to generate embeddings');
  }

  await checkDatabaseConnection();
  console.log('[backfill] connected to PostgreSQL');

  let total = 0;

  while (true) {
    const logs = await findErrorLogsMissingEmbeddings(BATCH_SIZE);

    if (logs.length === 0) break;

    const vectors = await embedTexts(
      logs.map((log) => log.message),
      { taskType: 'RETRIEVAL_DOCUMENT' },
    );

    const items = logs.map((log, index) => ({
      id: log.id,
      embedding: vectors[index],
    }));

    await updateLogEmbeddings(items);

    total += items.length;
    console.log(`[backfill] embedded ${total} log(s)`);
  }

  if (total === 0) {
    console.log('[backfill] no ERROR logs need embeddings');
  } else {
    console.log(`[backfill] done, embedded ${total} log(s)`);
  }
};

run()
  .catch((error) => {
    console.error('[backfill]', error.message);
    process.exitCode = 1;
  })
  .finally(() => closePool());
