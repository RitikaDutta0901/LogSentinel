# LogSentinel

**A high-throughput log aggregation and observability platform — a Mini-Splunk for centralized application logs.**

LogSentinel ingests high-volume application logs, buffers and batches writes into PostgreSQL, exposes indexed search and aggregation APIs, and renders a real-time React dashboard. It also uses Google Gemini to analyze recent error bursts and return a structured root-cause analysis with supporting evidence and remediation steps. ERROR logs are embedded with Gemini and stored in pgvector, enabling natural-language semantic search that grounds each answer in the most similar historical incidents.

---

## Table of Contents

- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Database Schema and Indexing](#database-schema-and-indexing)
- [API Documentation](#api-documentation)
- [Local Setup and Run Instructions](#local-setup-and-run-instructions)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Reliability and Design Notes](#reliability-and-design-notes)
- [License](#license)

---

## Key Features

- **High-throughput ingestion via batching:** Accepts one log or batches of up to 1,000 logs per request, buffers them in memory, and flushes to PostgreSQL every 5 seconds or when 100 logs accumulate.
- **Write amplification reduction:** Flushes up to 500 rows per parameterized multi-row `INSERT`, reducing database round trips and write load.
- **Backpressure and recovery:** Bounded 10,000-log buffer, failed-flush requeue, and graceful shutdown that drains pending logs before closing the connection pool.
- **Strict validation:** Validates service names, log levels, timestamps, messages, metadata shape, and payload size before accepting data.
- **Advanced search:** Filters by time range, level, and service; supports PostgreSQL full-text search over log messages with pagination and indexed query paths.
- **Semantic search (RAG):** Embeds `ERROR` messages at ingestion, stores 768-dimension vectors in pgvector with an HNSW cosine index, retrieves the five nearest historical errors for a natural-language query, and asks Gemini for a grounded root-cause analysis.
- **Embedding backfill:** A re-runnable `npm run db:backfill-embeddings` script embeds ERROR logs that were stored before embeddings were enabled.
- **Indexed query paths:** GIN indexes for JSONB metadata and full-text search, plus B-Tree indexes for timestamp, level, and service access patterns.
- **Real-time dashboard:** React dashboard with debounced search, faceted filters, live polling, expandable metadata, pagination, and an Errors-vs-Time bar chart.
- **AI-driven anomaly detection:** Sends the latest 20 `ERROR` logs to Gemini and returns a structured suggested root cause, confidence level, evidence, and recommended actions.
- **Operational safety:** Parameterized SQL, request size limits, timeouts, sanitized error responses, and API keys kept server-side.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite 8, Tailwind CSS 4, Recharts 3 |
| Backend | Node.js 20+, Express 5, ES Modules |
| Database | PostgreSQL 16, `pg` connection pool, raw SQL migrations, pgvector (HNSW) |
| AI / LLM | Google Gemini API (structured JSON output and 768-dimension embeddings) |
| Tooling | npm, dotenv, Vite proxy, Git |
| Architecture | REST API, in-process batching buffer, repository/service/controller layering |

---

## Architecture

The primary data path is:

`Client -> POST /api/ingest -> Express validation and batching buffer -> PostgreSQL -> GET /api/logs -> React dashboard`

```text
+---------------------------+        POST /api/ingest         +-----------------------------+
|      Client Producers     |  ----------------------------> |        Express.js API       |
|  services, Postman, curl  |                                |  validation + backpressure  |
+---------------------------+                                +--------------+--------------+
                                                                          |
                                                                          v
                                                          +-------------------------------+
                                                          |    In-Memory Batching Buffer  |
                                                          |   flush: 100 logs OR 5 sec    |
                                                          |   cap: 10,000 logs            |
                                                          +---------------+---------------+
                                                                          |
                                                                          | multi-row INSERT
                                                                          | up to 500 rows
                                                                          v
                                                          +-------------------------------+
                                                          |         PostgreSQL 16         |
                                                          |  logs table                   |
                                                          |  UUID · TIMESTAMPTZ · JSONB   |
                                                          |  GIN + B-Tree indexes         |
                                                          +------+------------------+-----+
                                                                 ^                  ^
                                GET /api/logs, stats, services   |                  | SELECT latest
                                (React polling)                  |                  | 20 ERROR logs
                                                                 |                  |
+---------------------------+      HTTP / JSON      +----------+------------------+-+
|      React Dashboard      | <--------------------> |        Express API          |
|  Vite · Tailwind          |  GET /api/logs        |  query layer + AI service   |
|  Recharts · live polling  |  POST /api/analyze    +--------------+--------------+
+---------------------------+                                       |
                                                                    | generateContent
                                                                    v
                                                          +-----------------------------+
                                                          |         Gemini API          |
                                                          |  structured JSON response   |
                                                          +-----------------------------+
```

### Ingestion Flow

1. A service sends one log or a batch to `POST /api/ingest`.
2. The validator normalizes fields and rejects malformed payloads with detailed field-level errors.
3. Valid logs enter an in-memory buffer.
4. The buffer flushes when it reaches 100 logs or every 5 seconds.
5. Each flush writes up to 500 rows in a single parameterized `INSERT`.
6. Failed flushes are requeued; shutdown drains pending logs before the database pool closes.

### Query and Dashboard Flow

1. The React dashboard requests logs, service names, and error aggregates from the Express API.
2. Express builds parameterized SQL predicates for time range, level, service, and full-text search.
3. PostgreSQL serves the query through GIN and B-Tree indexes.
4. The dashboard polls every 5 seconds while live tail is enabled, updating the table, KPI cards, and chart.

### AI Analysis Flow

1. The user clicks **Analyze with AI** next to the error chart.
2. `POST /api/analyze` loads the 20 most recent `ERROR` logs.
3. Logs are serialized into a bounded prompt with an explicit instruction to treat log content as untrusted data.
4. Gemini is called with a structured JSON response schema.
5. The dashboard displays the root cause, confidence, evidence, and recommendations in a modal.

### Semantic Search (RAG) Flow

1. During ingestion, each `ERROR` message is embedded with Gemini and stored in the `embedding` column. `INFO` and `WARN` logs are not embedded.
2. The user opens **Semantic search** and asks a question such as "Why did checkout payments fail?".
3. `POST /api/analyze-rag` embeds the query, then retrieves the top five `ERROR` logs by cosine similarity using the HNSW index.
4. Gemini receives the query and the retrieved logs and returns a structured root-cause analysis grounded in that evidence.
5. The dashboard displays the analysis alongside each retrieved log and its similarity score.

---

## Database Schema and Indexing

### `logs` Table

| Column | Type | Constraints | Purpose |
| --- | --- | --- | --- |
| `id` | `UUID` | Primary key, default `gen_random_uuid()` | Unique event identifier |
| `timestamp` | `TIMESTAMPTZ` | Not null, default `NOW()` | Event time with timezone awareness |
| `service_name` | `TEXT` | Not null | Producing service |
| `log_level` | `VARCHAR(10)` | Not null, `CHECK` in `INFO`, `WARN`, `ERROR` | Severity classification |
| `message` | `TEXT` | Not null | Human-readable log message |
| `metadata` | `JSONB` | Not null, default `{}` | Dynamic structured fields such as request IDs, regions, and latency |
| `embedding` | `vector(768)` | Nullable | Gemini embedding of `ERROR` messages for semantic search |

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  service_name TEXT NOT NULL,
  log_level VARCHAR(10) NOT NULL CHECK (log_level IN ('INFO', 'WARN', 'ERROR')),
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding vector(768)
);
```

### Index Strategy

```sql
-- JSONB containment and key-existence queries
CREATE INDEX idx_logs_metadata_gin
  ON logs USING GIN (metadata);

-- Time-range scans and newest-first pagination
CREATE INDEX idx_logs_timestamp_btree
  ON logs USING BTREE (timestamp DESC);

-- Level-filtered timelines
CREATE INDEX idx_logs_level_timestamp_btree
  ON logs USING BTREE (log_level, timestamp DESC);

-- Per-service timelines
CREATE INDEX idx_logs_service_timestamp_btree
  ON logs USING BTREE (service_name, timestamp DESC);

-- Full-text search over log messages
CREATE INDEX idx_logs_message_fts
  ON logs USING GIN (to_tsvector('english', message));

-- Approximate nearest-neighbor search over ERROR log embeddings
CREATE INDEX idx_logs_embedding_hnsw
  ON logs USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

**Why GIN for JSONB:** `metadata` is schemaless, so a B-Tree cannot efficiently answer containment queries such as `metadata @> '{"region":"us-east-1"}'`. A GIN inverted index indexes JSONB keys and values and avoids sequential scans as metadata grows.

**Why GIN for full-text search:** The expression index on `to_tsvector('english', message)` allows `@@ plainto_tsquery(...)` queries to use an index instead of scanning every message with `LIKE '%term%'`.

**Why B-Tree for timestamp and level:** B-Tree indexes support equality, range predicates, and ordered scans. `(timestamp DESC)` accelerates time-range filtering and the default newest-first pagination. The composite `(log_level, timestamp DESC)` and `(service_name, timestamp DESC)` indexes serve the most common dashboard filters while preserving timestamp ordering.

**Why HNSW for embeddings:** Semantic search ranks logs by cosine distance (`embedding <=> query_vector`). HNSW is an approximate nearest-neighbor index that keeps similarity search fast as the table grows, instead of comparing the query against every embedded row. Only `ERROR` logs receive embeddings; `INFO` and `WARN` rows keep `embedding = NULL`. Migration `003_add_log_embeddings.sql` requires the pgvector extension to be installed on the PostgreSQL server.

Indexes are applied through versioned migrations:

```bash
npm run db:migrate
```

---

## API Documentation

Base URL: `http://localhost:4000`

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness and database connectivity |
| `POST` | `/api/ingest` | Ingest one log or a batch of logs |
| `GET` | `/api/logs` | Search and paginate logs |
| `GET` | `/api/logs/services` | List distinct service names |
| `GET` | `/api/logs/stats` | Error counts bucketed over time |
| `POST` | `/api/analyze` | Analyze the latest 20 `ERROR` logs with Gemini |
| `POST` | `/api/analyze-rag` | Answer a natural-language query using similar `ERROR` logs (RAG) |

### `POST /api/ingest`

Accepts a single log object, an array of logs, or `{ "logs": [...] }`. The response is `202 Accepted` because writes are buffered asynchronously.

**Request**

```bash
curl -X POST http://localhost:4000/api/ingest \
  -H "Content-Type: application/json" \
  -d '[
    {
      "service_name": "checkout",
      "log_level": "ERROR",
      "message": "Payment authorization failed: connection pool timeout",
      "timestamp": "2026-10-27T10:15:00.000Z",
      "metadata": {
        "orderId": "ORD-1042",
        "region": "us-east-1",
        "poolActive": 20,
        "poolMax": 20
      }
    },
    {
      "service_name": "gateway",
      "log_level": "WARN",
      "message": "Upstream checkout-service latency exceeded 2000ms",
      "metadata": {
        "upstream": "checkout-service",
        "latencyMs": 2134
      }
    }
  ]'
```

**Response — `202 Accepted`**

```json
{
  "success": true,
  "accepted": 2,
  "buffered": 2
}
```

**Validation error — `400 Bad Request`**

```json
{
  "success": false,
  "error": "Invalid log payload",
  "details": [
    {
      "index": 0,
      "field": "log_level",
      "message": "log_level must be one of INFO, WARN, ERROR"
    }
  ]
}
```

Ingestion limits: 1,000 logs per request, 16,384 characters per message, 64 KB per metadata object, 255 characters per service name, and a 10,000-log in-memory buffer.

### `GET /api/logs`

Query parameters:

| Parameter | Values | Default |
| --- | --- | --- |
| `timeRange` | `15m`, `1h`, `6h`, `24h`, `7d`, `30d`, any `Nm`/`Nh`/`Nd`, or `all` | no time filter |
| `level` | `INFO`, `WARN`, `ERROR` | all levels |
| `service_name` | exact service name | all services |
| `search` | full-text search string | none |
| `page` | positive integer | `1` |
| `limit` | `1`–`200` | `50` |

**Request**

```bash
curl "http://localhost:4000/api/logs?timeRange=24h&level=ERROR&service_name=checkout&search=payment&page=1&limit=50"
```

**Response — `200 OK`**

```json
{
  "success": true,
  "data": [
    {
      "id": "0e61250c-34e0-4116-a96d-62a73d524173",
      "timestamp": "2026-10-27T10:14:30.917Z",
      "service_name": "checkout",
      "log_level": "ERROR",
      "message": "Payment authorization failed: connection pool timeout",
      "metadata": {
        "orderId": "ORD-1042",
        "region": "us-east-1"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

### `GET /api/logs/services`

```json
{
  "success": true,
  "data": ["auth", "billing", "checkout", "gateway", "search"]
}
```

### `GET /api/logs/stats`

Returns `ERROR` counts grouped into time buckets selected automatically from the requested range.

```bash
curl "http://localhost:4000/api/logs/stats?timeRange=24h&service_name=checkout"
```

```json
{
  "success": true,
  "intervalSeconds": 3600,
  "since": "2026-10-26T10:00:00.000Z",
  "data": [
    {
      "bucket": "2026-10-27T08:00:00.000Z",
      "count": 1
    },
    {
      "bucket": "2026-10-27T09:00:00.000Z",
      "count": 3
    }
  ]
}
```

### `POST /api/analyze`

Fetches the 20 most recent `ERROR` logs, sends them to Gemini, and returns a structured analysis. No request body is required.

**Request**

```bash
curl -X POST http://localhost:4000/api/analyze
```

**Response — `200 OK`**

```json
{
  "success": true,
  "sampleSize": 20,
  "analyzedAt": "2026-10-27T10:26:00.000Z",
  "analysis": {
    "suggestedRootCause": "PostgreSQL connection pool exhaustion triggered by checkout retry storms, which cascaded into upstream timeouts across billing and gateway services.",
    "summary": "The ERROR sample is dominated by pool acquisition timeouts and upstream 504 responses clustered within the same 15-minute window. Checkout retries appear to amplify pressure on the shared connection pool.",
    "confidence": "high",
    "evidence": [
      "14 of 20 ERROR logs report connection pool acquisition timeouts.",
      "Checkout payment failures cluster within a 15-minute window.",
      "Gateway 504 errors begin immediately after checkout retry volume spikes."
    ],
    "recommendations": [
      "Increase the PostgreSQL pool size or add PgBouncer in front of the database.",
      "Add exponential backoff and jitter to checkout payment retries.",
      "Alert when pool utilization exceeds 80% for more than two minutes."
    ]
  }
}
```

**No error logs — `200 OK`**

```json
{
  "success": true,
  "sampleSize": 0,
  "analysis": null,
  "message": "No ERROR logs are available to analyze"
}
```

**AI configuration error — `503 Service Unavailable`**

```json
{
  "success": false,
  "error": "AI analysis is not configured. Set GEMINI_API_KEY on the server."
}
```

Other failure modes: `502` when the AI provider fails or is unreachable, `504` on timeout, and `429` when the provider rate limit is reached.

### `POST /api/analyze-rag`

Answers a natural-language question using retrieval-augmented generation. The query is embedded, the five most similar `ERROR` logs are retrieved by cosine similarity, and Gemini produces a structured analysis grounded in those logs.

**Request**

```bash
curl -X POST http://localhost:4000/api/analyze-rag \
  -H "Content-Type: application/json" \
  -d '{"query":"Why did checkout payments fail?"}'
```

The `query` field is required, must be non-empty, and is limited to 1,000 characters.

**Response — `200 OK`**

```json
{
  "success": true,
  "analyzedAt": "2026-10-27T10:26:00.000Z",
  "query": "Why did checkout payments fail?",
  "contextCount": 5,
  "retrievedLogs": [
    {
      "id": "0e61250c-34e0-4116-a96d-62a73d524173",
      "timestamp": "2026-10-27T10:14:30.917Z",
      "service": "checkout",
      "message": "Payment authorization failed: connection pool timeout",
      "metadata": {
        "orderId": "ORD-1042",
        "region": "us-east-1"
      },
      "similarity": 0.87
    }
  ],
  "analysis": {
    "suggestedRootCause": "PostgreSQL connection pool exhaustion caused checkout payment authorization timeouts.",
    "summary": "Retrieved errors cluster around pool acquisition failures during a checkout retry burst.",
    "confidence": "high",
    "evidence": [
      "The most similar log reports a connection pool timeout in checkout.",
      "Related errors share the same order and region metadata."
    ],
    "recommendations": [
      "Add PgBouncer or increase the PostgreSQL pool size.",
      "Add exponential backoff and jitter to checkout retries."
    ]
  }
}
```

If no embedded `ERROR` logs exist, `contextCount` is `0` and the analysis explicitly reports insufficient evidence. Failures use the same status codes as `/api/analyze`: `400` for an invalid query, `503` when `GEMINI_API_KEY` is missing, `502` for provider failures, `504` on timeout, and `429` for provider rate limits.

### `GET /health`

```json
{
  "status": "ok",
  "uptimeSeconds": 42,
  "timestamp": "2026-10-27T10:30:00.000Z",
  "database": {
    "status": "connected",
    "latencyMs": 2
  }
}
```

Returns `503` with `"status": "degraded"` if PostgreSQL is unreachable.

---

## Local Setup and Run Instructions

### Prerequisites

- Node.js 20.19+ or 22.12+ (required by Vite 8)
- npm 10 or newer
- PostgreSQL 14 or newer, running locally or reachable over the network
- The [pgvector](https://github.com/pgvector/pgvector) extension available for your PostgreSQL version (required for semantic search)
- A Google Gemini API key for AI analysis and embeddings (required for semantic search, optional for non-AI features)

### 1. Clone the Repository

```bash
git clone https://github.com/RitikaDutta0901/LogSentinel.git
cd LogSentinel
```

### 2. Install Backend Dependencies

```bash
npm install
```

### 3. Create the Database

```bash
createdb logsentinel
```

If `createdb` is unavailable, create the database with `psql`:

```sql
CREATE DATABASE logsentinel;
```

### 4. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your PostgreSQL credentials. Either use `DATABASE_URL` or the individual `PG*` variables. Set `GEMINI_API_KEY` too if you want AI analysis and semantic search.

### 5. Install pgvector and Run Migrations

Install pgvector for your PostgreSQL version. On Debian or Ubuntu, the package is usually named after the server version:

```bash
sudo apt install postgresql-16-pgvector
```

On macOS with Homebrew, `brew install pgvector` works for a locally built PostgreSQL. Managed providers usually have an extension allowlist; enable `vector` there. Then run:

```bash
npm run db:migrate
```

This creates the `logs` table, the migration tracking table, the GIN/B-Tree indexes, and the pgvector `embedding` column with its HNSW index. Migration `003` runs `CREATE EXTENSION IF NOT EXISTS vector;`, so the database role must be allowed to create extensions. The runner is idempotent and skips migrations already applied.

### 6. Backfill Embeddings for Existing ERROR Logs (Optional)

If the database already contains `ERROR` logs from before embeddings were enabled, generate their vectors once:

```bash
npm run db:backfill-embeddings
```

The script requires `GEMINI_API_KEY`, processes logs whose `embedding` is `NULL` in batches of 50, and is safe to re-run. New `ERROR` logs are embedded automatically during ingestion, so this step is only needed for pre-existing data.

### 7. Start the Backend

```bash
npm run dev
```

For production-style startup:

```bash
npm start
```

The API listens on `http://localhost:4000` by default. Verify it:

```bash
curl http://localhost:4000/health
```

### 8. Install and Start the Frontend

Open a second terminal:

```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` requests to the backend at `http://localhost:4000`.

### 9. Seed Sample Logs

```bash
curl -X POST http://localhost:4000/api/ingest \
  -H "Content-Type: application/json" \
  -d '[
    {
      "service_name": "checkout",
      "log_level": "ERROR",
      "message": "Payment authorization failed: connection pool timeout",
      "metadata": { "orderId": "ORD-1042", "region": "us-east-1" }
    },
    {
      "service_name": "auth",
      "log_level": "WARN",
      "message": "Token refresh delayed by upstream identity provider"
    },
    {
      "service_name": "gateway",
      "log_level": "INFO",
      "message": "GET /api/v1/catalog responded 200 in 84ms"
    }
  ]'
```

Logs appear in the dashboard within approximately 5 seconds after the buffer flush.

### 10. Enable AI Analysis and Semantic Search

Add your key to `.env` and restart the backend:

```bash
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-2.5-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
```

Restart the backend after changing `.env`. Then click **Analyze with AI** to analyze the latest errors, or **Semantic search** to ask a natural-language question. The semantic search modal shows the grounded analysis along with the retrieved logs and their similarity scores. If you enabled embeddings after logs were already stored, run `npm run db:backfill-embeddings` once.

### 11. Build the Frontend for Production

```bash
cd client
npm run build
npm run preview
```

---

## Environment Variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `PORT` | No | `4000` | Express API port |
| `NODE_ENV` | No | `development` | Runtime environment |
| `DATABASE_URL` | No | — | Full PostgreSQL connection string; takes precedence when set |
| `PGHOST` | Yes* | `localhost` | PostgreSQL host |
| `PGPORT` | No | `5432` | PostgreSQL port |
| `PGUSER` | Yes* | `postgres` | PostgreSQL user |
| `PGPASSWORD` | No | empty | PostgreSQL password |
| `PGDATABASE` | Yes* | `logsentinel` | PostgreSQL database name |
| `PGSSL` | No | `false` | Set to `true` for managed PostgreSQL with SSL |
| `GEMINI_API_KEY` | For AI | empty | Server-side Gemini API key for analysis and embeddings |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Gemini text model identifier |
| `GEMINI_EMBEDDING_MODEL` | No | `gemini-embedding-001` | Gemini embedding model identifier |
| `GEMINI_API_BASE_URL` | No | Google API URL | Override for enterprise gateways or test mocks |
| `GEMINI_TIMEOUT_MS` | No | `30000` | Gemini analysis request timeout in milliseconds |
| `GEMINI_EMBEDDING_TIMEOUT_MS` | No | `10000` | Gemini embedding request timeout in milliseconds |

\* Required when `DATABASE_URL` is not set.

The `.env` file is git-ignored. The repository includes `.env.example` with all supported settings.

---

## Project Structure

```text
LogSentinel/
├── src/
│   ├── config/               # Environment validation and PostgreSQL pool
│   ├── controllers/          # HTTP request handlers
│   ├── db/
│   │   ├── migrations/       # Schema, index, and pgvector migrations
│   │   ├── backfillEmbeddings.js  # Embed ERROR logs stored before RAG
│   │   └── migrate.js        # Idempotent migration runner
│   ├── errors/               # Shared HTTP and validation errors
│   ├── middleware/           # 404 and centralized error handling
│   ├── repositories/         # Parameterized SQL queries
│   ├── routes/               # Express route definitions
│   ├── services/             # Batching, embeddings, RAG, and Gemini analysis
│   ├── validators/           # Ingestion, query, and RAG validation
│   ├── app.js                # Express application setup
│   └── server.js             # Startup, health check, graceful shutdown
├── client/
│   └── src/
│       ├── api/              # Backend API clients
│       ├── components/       # Dashboard, chart, log stream, AI and semantic search modals
│       ├── hooks/            # Polling and debounce hooks
│       ├── utils/            # Formatting and chart transforms
│       ├── App.jsx
│       └── main.jsx
├── .env.example
├── package.json
└── README.md
```

---

## Reliability and Design Notes

- **Parameterized SQL everywhere:** User input is never concatenated into SQL, preventing SQL injection.
- **Multi-row inserts:** Each flush uses a single `INSERT ... VALUES (...), (...)` statement, capped at 500 rows to stay well below PostgreSQL parameter limits.
- **Backpressure:** Ingestion returns `503` when the 10,000-log buffer is full rather than allowing unbounded memory growth.
- **Failure recovery:** A failed flush requeues the batch and retries on the next cycle; the oldest logs are dropped only if the buffer is saturated.
- **Graceful shutdown:** `SIGINT` and `SIGTERM` stop new requests, flush pending logs, then close the PostgreSQL pool.
- **Prompt-injection defense:** The AI system instruction explicitly treats log messages and metadata as untrusted data, not instructions.
- **AI resilience:** API key validation, provider timeouts, rate-limit handling, safe error messages, and structured response parsing prevent malformed model output from breaking the dashboard. Embedding requests use the same retry, timeout, and rate-limit handling.
- **Safe embedding backfill:** Only `ERROR` logs with `embedding IS NULL` are selected, updates are parameterized, and the script stops cleanly on provider failures. Re-running it never re-embeds completed rows.
- **Semantic search grounding:** Retrieved logs are treated as untrusted context, limited to the five nearest neighbors, and truncated before being placed in the prompt. The model is instructed to report insufficient evidence instead of inventing incidents.
- **Graceful embedding degradation:** If embeddings are unavailable, ERROR logs are still stored and the application keeps working; only semantic search for those rows is affected.
- **Single-instance buffer trade-off:** The in-process buffer is simple and fast for a single API instance. Horizontal scaling would require a shared queue such as Redis Streams or Kafka and idempotent consumers.

---

## License

MIT
