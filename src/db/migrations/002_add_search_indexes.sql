CREATE INDEX IF NOT EXISTS idx_logs_metadata_gin
  ON logs USING GIN (metadata);

CREATE INDEX IF NOT EXISTS idx_logs_timestamp_btree
  ON logs USING BTREE (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_logs_level_timestamp_btree
  ON logs USING BTREE (log_level, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_logs_service_timestamp_btree
  ON logs USING BTREE (service_name, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_logs_message_fts
  ON logs USING GIN (to_tsvector('english', message));
