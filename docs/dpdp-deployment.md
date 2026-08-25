# India DPDP Act Deployment & Regional Data Pinning Guide

This document specifies the deployment architecture, configuration parameters, data residency mappings, and LLM provider endpoints required to operate **AgentWatch** in strict compliance with the **Digital Personal Data Protection Act, 2023 (DPDP Act)** and **CERT-In** data governance regulations.

---

## 1. Architectural Overview & Compliance Objectives

The DPDP Act mandates rigorous safeguards regarding the processing of digital personal data:
- **Data Minimization & Sanitization**: Raw personal data (PII, secrets, identifiers) must be masked at ingestion before entering analytical or long-term storage.
- **Data Residency & Localization**: All databases, stream buffers, encryption keys, and log archives must physically reside within the sovereign borders of the Republic of India.
- **Storage Limitation & Right to Erasure**: Data must be automatically hard-deleted after the defined retention window (`retention_days`).
- **Accountability & Audit Trails**: Every unmasking, administrative operation, and data export must be logged in an immutable, auditable log exportable in CSV and PDF formats.

```
                    ┌────────────────────────────────────────────────────────┐
                    │               INDIAN CLOUD REGION (VPC)                │
                    │         (AWS ap-south-1 / Azure centralindia)          │
                    │                                                        │
                    │  ┌──────────────┐         ┌─────────────────────────┐  │
SDK / Client App ───┼─►│Ingestion API │────────►│ Redis 7 Stream Buffer   │  │
(In-Region Traffic) │  └──────┬───────┘         └───────────┬─────────────┘  │
                    │         │ (Auth & Log)                │                │
                    │         ▼                             ▼                │
                    │  ┌──────────────┐         ┌─────────────────────────┐  │
                    │  │PostgreSQL 16 │◄────────┤ Background Worker       │  │
                    │  │(PII Mappings,│(Enc PII)│ (Presidio + Fernet)     │  │
                    │  │ Audit Logs)  │         └───────────┬─────────────┘  │
                    │  └──────────────┘                     │ (Masked Spans) │
                    │                                       ▼                │
                    │                           ┌─────────────────────────┐  │
                    │                           │ ClickHouse 24.8         │  │
                    │                           │ (Partitioned Analytics) │  │
                    │                           └─────────────────────────┘  │
                    └────────────────────────────────────────────────────────┘
```

---

## 2. Physical Data Layer Residency

All storage systems and compute instances must be provisioned exclusively within Indian data centers:

| Data Layer | Stored Data Types | Physical Storage Location | Recommended Managed Services |
| :--- | :--- | :--- | :--- |
| **PostgreSQL 16** | Organization configs, scoped API keys, Fernet-encrypted PII tokens (`pii_mappings`), audit trail (`audit_log`). | India Central (Pune) / Mumbai (`ap-south-1`) | - AWS RDS PostgreSQL (`ap-south-1`)<br>- Azure Database for PostgreSQL (`centralindia`)<br>- GCP Cloud SQL (`asia-south1`) |
| **ClickHouse 24.8** | Masked execution spans (`agentwatch.spans`), daily aggregated metrics (`daily_span_metrics`). | India Central / Mumbai / Hyderabad | - ClickHouse Cloud (AWS Mumbai `ap-south-1`)<br>- Self-hosted ClickHouse on EBS `gp3` (encrypted at rest) |
| **Redis 7** | In-flight span queue (`spans:incoming`), rate-limiting counters, dead-letter stream. | In-VPC memory instances in India | - AWS ElastiCache for Redis (`ap-south-1`)<br>- Azure Cache for Redis (`centralindia`) |
| **Key Management** | Master encryption keys, `PII_FERNET_KEY` derivation. | Dedicated Indian Cloud Hardware Security Modules (HSM) | - AWS KMS (`ap-south-1`)<br>- Azure Key Vault (`centralindia`)<br>- Google Cloud KMS (`asia-south1`) |

---

## 3. Environment Variables for Regional Configuration

Deployments must set the following environment variables across services to enforce Indian data residency:

### Infrastructure & Cloud Region Variables
```env
# Cloud Provider Region Pins
AWS_REGION=ap-south-1
AWS_DEFAULT_REGION=ap-south-1
AZURE_LOCATION=centralindia
GCP_REGION=asia-south1

# PostgreSQL Connection (Encrypted in transit)
DATABASE_URL=postgresql://agentwatch:<DB_PASSWORD>@postgres.internal.ap-south-1.aws:5432/agentwatch?sslmode=verify-full

# ClickHouse Analytical Cluster (Encrypted Native/HTTP)
CLICKHOUSE_HOST=clickhouse.internal.ap-south-1.aws
CLICKHOUSE_PORT=8123
CLICKHOUSE_USER=agentwatch
CLICKHOUSE_PASSWORD=<CLICKHOUSE_PASSWORD>
CLICKHOUSE_SECURE=True

# Redis In-Region Cluster
REDIS_URL=rediss://redis.internal.ap-south-1.aws:6379/0

# Ingestion API & Service Base URLs
INGESTION_API_URL=https://ingest-india.agentwatch.internal:8000
```

### Security, PII Encryption & Retention
```env
# Fernet 256-bit symmetric key for PII tokenization (Must be generated in Indian HSM)
PII_FERNET_KEY=<GENERATED_FERNET_KEY>

# Worker Retention Cleaner Configuration
RETENTION_CHECK_INTERVAL_SECONDS=3600

# Edge Security & Rate Limiting
SPAN_BACKEND=redis
AUTH_DISABLED=false
RATE_LIMIT_PER_MINUTE=600
```

---

## 4. In-Region LLM Provider Endpoints for Evaluations & Inference

To ensure that prompts and evaluation workloads processed by agents do not cross international boundaries, configure client applications and evaluation pipelines with **India-local provider endpoints**:

### 1. Azure OpenAI Service (India Regions)
Deploy model deployments in `centralindia` (Pune) or `southindia` (Chennai):
```python
from openai import AzureOpenAI

client = AzureOpenAI(
    azure_endpoint="https://agentwatch-india-central.openai.azure.com/",
    api_key=os.environ["AZURE_OPENAI_API_KEY"],
    api_version="2024-08-01-preview"
)
# Models available in-region: gpt-4o, gpt-4o-mini
```

### 2. AWS Bedrock (Mumbai — `ap-south-1`)
Configure AWS Bedrock client pinned to Mumbai:
```python
import boto3

bedrock = boto3.client(
    service_name="bedrock-runtime",
    region_name="ap-south-1"
)
# In-region models: Anthropic Claude 3.5 Sonnet, Claude 3 Haiku, Amazon Titan Text Premier, Meta Llama 3.1
```

### 3. Google Cloud Vertex AI (Mumbai `asia-south1` / Delhi `asia-south2`)
```python
import vertexai
from vertexai.generative_models import GenerativeModel

vertexai.init(project="my-agent-project", location="asia-south1")
model = GenerativeModel("gemini-1.5-flash-002")
```

### 4. Self-Hosted On-Premise / GPU Inference (vLLM)
For strict air-gapped or banking deployments, host open models (e.g. Llama 3.3 70B, Mistral, Qwen) using vLLM on GPU instances (`g5.12xlarge` / `g6e`) in AWS `ap-south-1`.

---

## 5. PII Detection & Encryption Engine

AgentWatch utilizes Microsoft Presidio configured with custom recognizers tailored for Indian identification documents in [`worker/pii_engine.py`](file:///c:/Users/Admin/Documents/Codex/2026-08-20/create-a-monorepo-called-agentwatch-with/worker/pii_engine.py):

- **Aadhaar Number**: `\b\d{4}\s?\d{4}\s?\d{4}\b` (Confidence: 0.9)
- **Indian PAN Card**: `\b[A-Z]{5}[0-9]{4}[A-Z]\b` (Confidence: 0.9)
- **Global Identifiers**: Email addresses, credit card numbers, phone numbers, API secrets, IP addresses, names.

Original sensitive values are replaced with tokens (e.g., `<INDIAN_PAN_1>`) before storage in ClickHouse, while the encrypted payload is stored in PostgreSQL under the tenant's isolated table partition.

---

## 6. Retention Enforcement & Right to Erasure

Under Section 12 of the DPDP Act, personal data must be erased once the specific processing purpose has been satisfied:

1. **Per-Organization Policy**: Set `retention_days` on the `orgs` table (default: `30` to `90` days).
2. **Automated Purge Daemon**: The background worker periodically executes:
   - **ClickHouse**: `ALTER TABLE agentwatch.spans DELETE WHERE org_id = '...' AND started_at < NOW() - INTERVAL retention_days DAY`
   - **PostgreSQL**: `DELETE FROM pii_mappings WHERE org_id = '...' AND created_at < NOW() - make_interval(days => retention_days)`

---

## 7. Compliance Audit Exports

Compliance and Data Protection Officers (DPO) can generate signed audit logs for any date range:

### CSV Export:
```http
GET /v1/compliance/audit-export?format=csv&started_after=2026-01-01T00:00:00Z&started_before=2026-01-31T23:59:59Z
Headers:
  X-AgentWatch-Key: <ORG_ADMIN_KEY>
```

### PDF Export:
```http
GET /v1/compliance/audit-export?format=pdf&started_after=2026-01-01T00:00:00Z&started_before=2026-01-31T23:59:59Z
Headers:
  X-AgentWatch-Key: <ORG_ADMIN_KEY>
```

Every audit export is itself recorded in `audit_log` under action `data_access` to maintain a tamper-evident audit trail.
