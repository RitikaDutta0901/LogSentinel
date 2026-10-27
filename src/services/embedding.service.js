import { env } from '../config/env.js';
import { HttpError } from '../errors/HttpError.js';

export const EMBEDDING_DIMENSIONS = 768;

const MAX_BATCH_SIZE = 100;
const MAX_EMBEDDING_INPUT_CHARS = 3000;
const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 250;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const truncate = (value, maxLength = 500) =>
  value.length > maxLength ? `${value.slice(0, maxLength)}... [truncated]` : value;

const normalizeModel = (model) => model.replace(/^models\//, '');

export const prepareEmbeddingText = (text) =>
  String(text ?? '')
    .trim()
    .slice(0, MAX_EMBEDDING_INPUT_CHARS);

const parseEmbeddings = (payload, expectedCount) => {
  const embeddings = payload?.embeddings;

  if (!Array.isArray(embeddings) || embeddings.length !== expectedCount) {
    throw new HttpError(502, 'AI embedding provider returned an invalid response');
  }

  return embeddings.map((item) => {
    const values = item?.values;

    if (
      !Array.isArray(values) ||
      values.length !== EMBEDDING_DIMENSIONS ||
      !values.every((value) => Number.isFinite(value))
    ) {
      throw new HttpError(
        502,
        `AI embedding provider returned a vector that is not ${EMBEDDING_DIMENSIONS}-dimensional`,
      );
    }

    return values;
  });
};

const requestEmbeddingBatch = async (texts, taskType) => {
  const model = normalizeModel(env.gemini.embeddingModel);
  const url = `${env.gemini.baseUrl}/v1beta/models/${encodeURIComponent(model)}:batchEmbedContents`;

  const body = JSON.stringify({
    requests: texts.map((text) => ({
      model: `models/${model}`,
      content: { parts: [{ text }] },
      taskType,
      outputDimensionality: EMBEDDING_DIMENSIONS,
    })),
  });

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.gemini.embeddingTimeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': env.gemini.apiKey,
        },
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        const retryable = response.status === 429 || response.status >= 500;

        console.error(
          `[embedding] Gemini request failed with status ${response.status} (attempt ${attempt}/${MAX_ATTEMPTS}): ${truncate(errorBody)}`,
        );

        if (retryable && attempt < MAX_ATTEMPTS) {
          await delay(RETRY_BASE_DELAY_MS * attempt);
          continue;
        }

        if (response.status === 429) {
          throw new HttpError(429, 'AI embedding provider rate limit reached');
        }

        throw new HttpError(502, 'AI embedding provider request failed');
      }

      const payload = await response.json().catch(() => null);

      if (!payload) {
        throw new HttpError(502, 'AI embedding provider returned an unreadable response');
      }

      return parseEmbeddings(payload, texts.length);
    } catch (error) {
      if (error instanceof HttpError) throw error;

      if (error.name === 'AbortError') {
        throw new HttpError(504, 'AI embedding request timed out');
      }

      if (attempt < MAX_ATTEMPTS) {
        await delay(RETRY_BASE_DELAY_MS * attempt);
        continue;
      }

      console.error('[embedding] Gemini request error:', error.message);
      throw new HttpError(502, 'Unable to reach the AI embedding provider');
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new HttpError(502, 'AI embedding provider request failed');
};

export const embedTexts = async (texts, { taskType = 'RETRIEVAL_DOCUMENT' } = {}) => {
  if (!Array.isArray(texts)) {
    throw new HttpError(400, 'Embedding input must be an array of strings');
  }

  if (texts.length === 0) return [];

  if (!env.gemini.apiKey) {
    throw new HttpError(503, 'Embeddings are not configured. Set GEMINI_API_KEY on the server.');
  }

  const prepared = texts.map((text) => prepareEmbeddingText(text));

  if (prepared.some((text) => text === '')) {
    throw new HttpError(400, 'Embedding input cannot be empty');
  }

  const vectors = [];

  for (let offset = 0; offset < prepared.length; offset += MAX_BATCH_SIZE) {
    const batch = prepared.slice(offset, offset + MAX_BATCH_SIZE);
    const batchVectors = await requestEmbeddingBatch(batch, taskType);
    vectors.push(...batchVectors);
  }

  return vectors;
};

let warnedMissingEmbeddingKey = false;

const attachErrorEmbeddings = async (logs) => {
  const errorLogs = logs.filter(
    (log) => log.logLevel === 'ERROR' && !Array.isArray(log.embedding),
  );

  if (errorLogs.length === 0) return logs;

  if (!env.gemini.apiKey) {
    if (!warnedMissingEmbeddingKey) {
      console.warn(
        '[embedding] GEMINI_API_KEY is not set; ERROR logs will be stored without embeddings',
      );
      warnedMissingEmbeddingKey = true;
    }
    return logs;
  }

  const uniqueTexts = new Map();

  for (const log of errorLogs) {
    const text = prepareEmbeddingText(log.message);
    if (!uniqueTexts.has(text)) {
      uniqueTexts.set(text, uniqueTexts.size);
    }
  }

  try {
    const vectors = await embedTexts([...uniqueTexts.keys()], {
      taskType: 'RETRIEVAL_DOCUMENT',
    });
    const embeddingsByText = new Map(
      [...uniqueTexts.keys()].map((text, index) => [text, vectors[index]]),
    );

    return logs.map((log) => {
      if (log.logLevel !== 'ERROR' || Array.isArray(log.embedding)) return log;

      const embedding = embeddingsByText.get(prepareEmbeddingText(log.message));
      return embedding ? { ...log, embedding } : log;
    });
  } catch (error) {
    console.error(
      `[embedding] Failed to embed ${errorLogs.length} ERROR log(s); storing them without embeddings: ${error.message}`,
    );
    return logs;
  }
};

export const embedErrorLogs = async (logs) => {
  if (!Array.isArray(logs) || logs.length === 0) return logs;
  return attachErrorEmbeddings(logs);
};
