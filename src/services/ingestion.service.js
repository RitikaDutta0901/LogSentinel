import { insertLogs } from '../repositories/log.repository.js';
import { embedErrorLogs } from './embedding.service.js';

const FLUSH_INTERVAL_MS = 5000;
const FLUSH_THRESHOLD = 100;
const MAX_BUFFER_SIZE = 10_000;
const MAX_INSERT_BATCH_SIZE = 500;

let buffer = [];
let flushPromise = null;
let flushTimer = null;
let lastFlushFailed = false;

const requeue = (batch) => {
  const capacity = MAX_BUFFER_SIZE - buffer.length;

  if (capacity <= 0) {
    console.error(`[ingest] Buffer full, dropping ${batch.length} log(s) after failed flush`);
    return;
  }

  if (batch.length > capacity) {
    const dropped = batch.length - capacity;
    console.error(`[ingest] Dropping ${dropped} oldest log(s) after failed flush`);
    buffer.unshift(...batch.slice(dropped));
    return;
  }

  buffer.unshift(...batch);
};

export const flushBuffer = () => {
  if (flushPromise) return flushPromise;

  flushPromise = (async () => {
    let flushed = 0;
    lastFlushFailed = false;

    while (buffer.length > 0) {
      const batch = buffer.splice(0, Math.min(buffer.length, MAX_INSERT_BATCH_SIZE));
      let preparedBatch = batch;

      try {
        preparedBatch = await embedErrorLogs(batch);
        await insertLogs(preparedBatch);
        flushed += batch.length;
      } catch (error) {
        lastFlushFailed = true;
        console.error(`[ingest] Failed to flush ${batch.length} log(s):`, error.message);
        requeue(preparedBatch);
        break;
      }
    }

    if (flushed > 0) {
      console.log(`[ingest] Flushed ${flushed} log(s) to PostgreSQL`);
    }

    return flushed;
  })().finally(() => {
    flushPromise = null;

    if (!lastFlushFailed && buffer.length >= FLUSH_THRESHOLD) {
      setImmediate(() => {
        flushBuffer().catch((error) => {
          console.error('[ingest] Background flush error:', error.message);
        });
      });
    }
  });

  return flushPromise;
};

export const enqueueLogs = (logs) => {
  if (buffer.length + logs.length > MAX_BUFFER_SIZE) {
    const error = new Error('Ingestion buffer is full, retry shortly');
    error.statusCode = 503;
    throw error;
  }

  buffer.push(...logs);

  if (buffer.length >= FLUSH_THRESHOLD) {
    flushBuffer().catch((error) => {
      console.error('[ingest] Background flush error:', error.message);
    });
  }

  return { buffered: buffer.length };
};

export const getBufferSize = () => buffer.length;

export const startLogFlusher = () => {
  if (flushTimer) return;

  flushTimer = setInterval(() => {
    flushBuffer().catch((error) => {
      console.error('[ingest] Scheduled flush error:', error.message);
    });
  }, FLUSH_INTERVAL_MS);

  flushTimer.unref();
};

export const stopLogFlusher = async () => {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }

  await flushBuffer();

  if (buffer.length > 0) {
    console.warn(`[ingest] Shutdown with ${buffer.length} unflushed log(s)`);
  }
};
