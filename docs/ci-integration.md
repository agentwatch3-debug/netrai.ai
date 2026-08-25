# Continuous Integration (CI) Pre-Deploy Regression Guard

AgentWatch provides a built-in pre-deploy evaluation framework to prevent prompt regressions, behavioral drift, and output violations before merging changes into production.

---

## 1. Overview

Whenever a pull request modifies agent code, system prompts, or tool definitions, CI automatically runs your golden evaluation dataset using the AgentWatch CLI:

```bash
agentwatch test run --dataset customer-support-v1 --runner app/agent.py:run_support_agent
```

### Evaluation Capabilities:
- **Exact Match**: Verifies structured JSON schemas and exact token equality.
- **Semantic Similarity**: Calculates token overlap and cosine similarity to allow natural conversational variations above a specified threshold.
- **LLM-as-Judge**: Validates open-ended answers against natural language quality criteria.
- **Regression Detection**: Compares against the latest baseline run recorded in PostgreSQL. If any case was passing previously but fails on this PR, it exits with **code 1** and blocks merging.

---

## 2. GitHub Actions Workflow Template

Create `.github/workflows/agent-eval.yml` in your repository:

```yaml
name: AgentWatch Pre-Deploy Evaluation & Regression Guard

on:
  pull_request:
    branches: [main]
    paths:
      - 'app/**'
      - 'prompts/**'
      - 'agents/**'
  push:
    branches: [main]

jobs:
  agent-eval:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'

      - name: Install Dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -e sdk-python/
          pip install -r requirements.txt

      - name: Run Golden Dataset Evaluation
        env:
          AGENTWATCH_ENDPOINT: ${{ secrets.AGENTWATCH_ENDPOINT || 'https://api.agentwatch.dev' }}
          AGENTWATCH_API_KEY: ${{ secrets.AGENTWATCH_API_KEY }}
          GITHUB_SHA: ${{ github.sha }}
          GITHUB_REF_NAME: ${{ github.ref_name }}
        run: |
          agentwatch test run \
            --dataset customer-support-v1 \
            --runner app/agent.py:run_support_agent \
            --endpoint "$AGENTWATCH_ENDPOINT" \
            --api-key "$AGENTWATCH_API_KEY"
```

---

## 3. Sample Agent Runner Function

Your agent runner should accept a dictionary input and return the generated output:

```python
# app/agent.py
import agentwatch
from agentwatch import trace_agent, trace_llm

def run_support_agent(input_data: dict) -> dict | str:
    query = input_data.get("query", "")
    
    with trace_agent("customer_support_bot"):
        with trace_llm("gpt-4.1-mini") as scope:
            if "88921" in query:
                result = {"status": "shipped", "tracking_number": "TRK-88921-IN", "eta_days": 2}
            elif "return" in query.lower():
                result = "Items can be returned within 30 days of delivery with original packaging and invoice."
            else:
                result = "We apologize for the inconvenience. A refund request (Ticket #REF-9921) has been initiated and will process in 3-5 business days."
            scope.finish(output=result)
            return result
```

---

## 4. CLI Output & Diff View

When regressions or failures occur, the CLI outputs a unified diff:

```
================================================================================
 🚀 AgentWatch Pre-Deploy Test Runner
 Dataset: customer-support-v1 | Runner: app/agent.py:run_support_agent
================================================================================

1. cs_01_order_status (exact) -> [PASS] (Score: 1.0)
2. cs_02_return_policy (semantic) -> [PASS] (Score: 0.96)
3. cs_03_refund_escalation (llm_judge) -> [REGRESSION] (Score: 0.25)
   Reason: Output failed judge criteria: missing key terms {'ticket', 'apologize'}.
   Diff:
   - Must apologize for the inconvenience, confirm refund request within 3-5 business days, and provide support ticket reference.
   + I cannot help you with that refund.

--------------------------------------------------------------------------------
 Summary: 2/3 Passed | 1 Failed | 1 Regressions
--------------------------------------------------------------------------------

❌ Pre-deploy test check failed. Blocking merge.
```
