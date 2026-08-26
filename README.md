# agentwatch

Monorepo for collecting, processing, storing, and visualizing agent execution spans.

## Services

- `sdk-python` — Python client for emitting OpenTelemetry-compatible spans.
- `ingestion-api` — FastAPI endpoint that validates and publishes spans to Redis Streams.
- `worker` — Redis Streams consumer that persists spans to ClickHouse.
- `dashboard` — Next.js 14 dashboard.
- `infra` — local ClickHouse, PostgreSQL, and Redis services.

## Local infrastructure

```sh
docker compose -f infra/docker-compose.yml up -d
```

See `docs/schema.md` for the canonical event schema and storage DDL.

## Develop without Docker

The ingestion API can run with an in-memory span store while Docker is unavailable. From PowerShell:

```powershell
cd ingestion-api
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:SPAN_BACKEND = "memory"
uvicorn app.main:app --reload
```

The API is then available at `http://127.0.0.1:8000`; view its interactive API at `/docs`. Memory-mode data is discarded when the API restarts.

Run the dashboard separately:

```powershell
cd dashboard
npm install
npm run dev
```

## Python SDK

Install locally with `pip install -e ./sdk-python`. Configure `AGENTWATCH_API_KEY`, `AGENTWATCH_ENDPOINT`, and optionally `AGENTWATCH_ORG_ID`, then trace provider calls or arbitrary tools:

```python
from agentwatch import trace_agent, trace_llm, trace_tool

@trace_llm()
def ask_model():
    return client.chat.completions.create(model="gpt-4.1-mini", messages=[...])

@trace_tool()
def search(query):
    return index.search(query)

with trace_agent("research", agent_id="researcher"):
    search("pricing")
    ask_model()
```

Use `with trace_llm() as span:` and call `span.record_response(response)` when a context-manager style is preferred.

## PII masking and unmasking

Before running the worker and ingestion API, configure shared Fernet encryption keys via `PII_FERNET_KEYS` (or single `PII_FERNET_KEY`). Generate keys with:
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

The worker replaces detected PII in `input` and `output` with tokens before ClickHouse insertion and stores only encrypted token mappings in Postgres.

> [!IMPORTANT]
> `PII_FERNET_KEYS` supports a comma-separated key ring (`PII_FERNET_KEYS="<new_key>,<old_key>"`) implementing `cryptography.fernet.MultiFernet`. The **first key** is used for all new encryptions, while **all keys** are attempted in order for unmasking and decryption.
>
> `PII_FERNET_KEYS` **must be identical** across both the `worker` and `ingestion-api` services, and stored in a secure secrets manager (never committed to git or stored in `.env.example` beyond placeholder values) for any real deployment. See [Key Rotation Guide](docs/key-rotation.md) for full rotation instructions.

API keys have an `ingest` scope by default. Grant `unmask` explicitly only to audited, trusted keys. `POST /v1/spans/{span_id}/unmask` returns authorized token replacements and records an immutable audit entry.

## Dashboard

Copy `dashboard/.env.example` to `dashboard/.env.local` and provide the Clerk keys, database URL, ingestion API URL, and a dashboard service key. In Clerk, configure a webhook for `organization.created` at `/api/webhooks/clerk`; the dashboard stores the resulting Clerk organization ID in Postgres before serving its data.
