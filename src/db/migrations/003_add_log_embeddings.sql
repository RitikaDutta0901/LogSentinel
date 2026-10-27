CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE logs
  ADD COLUMN IF NOT EXISTS embedding vector(768);

CREATE INDEX IF NOT EXISTS idx_logs_embedding_hnsw
  ON logs USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
