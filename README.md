# LogSentinel

**A high-throughput log aggregation and observability platform — a Mini-Splunk for centralized application logs.**

LogSentinel ingests high-volume application logs, buffers and batches writes into PostgreSQL, exposes indexed search and aggregation APIs, and renders a real-time React dashboard. It also uses Google Gemini to analyze recent error bursts and return a structured root-cause analysis with supporting evidence and remediation steps.

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
| Database | PostgreSQL 16, `pg` connection pool, raw SQL migrations |
| AI / LLM | Google Gemini API (structured JSON output) |
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

```sql
CREATE TABLE IF NOT EXISTS logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  service_name TEXT NOT NULL,
  log_level VARCHAR(10) NOT NULL CHECK (log_level IN ('INFO', 'WARN', 'ERROR')),
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
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
```

**Why GIN for JSONB:** `metadata` is schemaless, so a B-Tree cannot efficiently answer containment queries such as `metadata @> '{"region":"us-east-1"}'`. A GIN inverted index indexes JSONB keys and values and avoids sequential scans as metadata grows.

**Why GIN for full-text search:** The expression index on `to_tsvector('english', message)` allows `@@ plainto_tsquery(...)` queries to use an index instead of scanning every message with `LIKE '%term%'`.

**Why B-Tree for timestamp and level:** B-Tree indexes support equality, range predicates, and ordered scans. `(timestamp DESC)` accelerates time-range filtering and the default newest-first pagination. The composite `(log_level, timestamp DESC)` and `(service_name, timestamp DESC)` indexes serve the most common dashboard filters while preserving timestamp ordering.

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
- A Google Gemini API key for AI analysis (optional for non-AI features)

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

Edit `.env` with your PostgreSQL credentials. Either use `DATABASE_URL` or the individual `PG*` variables.

### 5. Run Database Migrations

```bash
npm run db:migrate
```

This creates the `logs` table, the migration tracking table, and all GIN/B-Tree indexes. The runner is idempotent and skips migrations already applied.

### 6. Start the Backend

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

### 7. Install and Start the Frontend

Open a second terminal:

```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` requests to the backend at `http://localhost:4000`.

### 8. Seed Sample Logs

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

### 9. Enable AI Analysis

Add your key to `.env` and restart the backend:

```bash
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```

Then click **Analyze with AI** in the dashboard. The modal displays the suggested root cause, confidence, evidence, and recommended actions.

### 10. Build the Frontend for Production

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
| `GEMINI_API_KEY` | For AI | empty | Server-side Gemini API key |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Gemini model identifier |
| `GEMINI_API_BASE_URL` | No | Google API URL | Override for enterprise gateways or test mocks |
| `GEMINI_TIMEOUT_MS` | No | `30000` | Gemini request timeout in milliseconds |

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
│   │   ├── migrations/       # Schema and index migrations
│   │   └── migrate.js        # Idempotent migration runner
│   ├── errors/               # Shared HTTP and validation errors
│   ├── middleware/           # 404 and centralized error handling
│   ├── repositories/         # Parameterized SQL queries
│   ├── routes/               # Express route definitions
│   ├── services/             # Batching and Gemini analysis services
│   ├── validators/           # Ingestion and query validation
│   ├── app.js                # Express application setup
│   └── server.js             # Startup, health check, graceful shutdown
├── client/
│   └── src/
│       ├── api/              # Backend API clients
│       ├── components/       # Dashboard, chart, log stream, AI modal
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
- **AI resilience:** API key validation, provider timeouts, rate-limit handling, safe error messages, and structured response parsing prevent malformed model output from breaking the dashboard.
- **Single-instance buffer trade-off:** The in-process buffer is simple and fast for a single API instance. Horizontal scaling would require a shared queue such as Redis Streams or Kafka and idempotent consumers.

---

## License

MIT
