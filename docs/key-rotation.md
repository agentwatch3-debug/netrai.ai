# PII Fernet Encryption Key Rotation Guide

This guide documents the cryptographic key rotation procedure for **AgentWatch** PII reversible tokenization using `cryptography.fernet.MultiFernet`.

---

## 1. Overview & Architecture

AgentWatch uses symmetric Fernet (AES-128 in CBC mode with HMAC-SHA256 authentication) to encrypt raw PII values into `pii_mappings` in PostgreSQL when spans are masked by the background worker.

To achieve zero-downtime key rotation without re-encrypting existing database rows, AgentWatch supports a **comma-separated keyring** in `PII_FERNET_KEYS`:

```env
PII_FERNET_KEYS="<NEW_PRIMARY_KEY>,<PREVIOUS_KEY_1>,<PREVIOUS_KEY_2>"
```

### Encryption vs. Decryption Semantics (`MultiFernet`)
- **New Encryptions (Writes)**: Always use the **FIRST key** (index `0`) in `PII_FERNET_KEYS`.
- **Decryptions (Reads / Unmasking)**: Attempt decryption across **ALL keys in order** (`0`, `1`, `2`, ...) until the matching key successfully decrypts the ciphertext.

---

## 2. Step-by-Step Key Rotation Procedure

```
Phase 1: Generate New Key   ──►   Phase 2: Prepend & Deploy   ──►   Phase 3: Wait Retention Window   ──►   Phase 4: Retire Old Key
   (KMS / HSM)                   (PII_FERNET_KEYS="k2,k1")             (retention_days = 30-90)             (PII_FERNET_KEYS="k2")
```

### Phase 1: Generate a New Fernet Key
Generate a secure 256-bit base64-encoded key in your Cloud KMS / HSM (or locally using Python):

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```
*Example new key*: `k2_9vF7z...`

---

### Phase 2: Add New Key to the Front & Redeploy
1. In your cloud secrets manager (AWS Secrets Manager, Azure Key Vault, GCP Secret Manager), update `PII_FERNET_KEYS`:
   - **Before**: `PII_FERNET_KEYS="k1_oldKey..."`
   - **After**: `PII_FERNET_KEYS="k2_newKey...,k1_oldKey..."`
2. Ensure `PII_FERNET_KEYS` is identical across both **`worker`** and **`ingestion-api`** containers.
3. Perform a rolling restart / deployment:
   - All newly ingested spans and PII mappings will be encrypted using `k2_newKey`.
   - Any historical unmasking requests for older spans will automatically decrypt using `k1_oldKey`.

---

### Phase 3: Wait for the Data Retention Window
Wait until the active organization data retention window (`retention_days`, e.g., 30, 60, or 90 days) has elapsed.

During this window, the worker retention daemon automatically purges all Postgres `pii_mappings` and ClickHouse `spans` that were encrypted under `k1_oldKey`.

You can verify that no active records use the old key by querying PostgreSQL:
```sql
SELECT count(*) FROM pii_mappings WHERE created_at < NOW() - INTERVAL '30 days';
```

---

### Phase 4: Retire and Remove the Old Key
Once all data encrypted with the old key has been purged or expired:
1. Update `PII_FERNET_KEYS` in secrets manager to remove the deprecated key:
   - `PII_FERNET_KEYS="k2_newKey..."`
2. Redeploy the `worker` and `ingestion-api` services.
3. Safely decommission or revoke the old key `k1_oldKey` in KMS.

---

## 3. Environment Variable Reference

| Variable | Type | Description |
| :--- | :--- | :--- |
| `PII_FERNET_KEYS` | String (comma-separated) | **Recommended**: Ordered list of Fernet keys (`newest,older,oldest`). First key encrypts; all keys decrypt. |
| `PII_FERNET_KEY` | String (single key) | **Legacy fallback**: Single Fernet key. Used if `PII_FERNET_KEYS` is not set. |

> [!IMPORTANT]
> `PII_FERNET_KEYS` must be kept strictly consistent between the `worker` service and the `ingestion-api` service. Store this value in a secure cloud secret store and never commit keys to source control.
