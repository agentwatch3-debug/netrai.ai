"""End-User Quota and Rate Limiting Check Helper."""

import logging
from typing import Any

import httpx

from .config import get_config
from .exceptions import QuotaExceeded

logger = logging.getLogger("agentwatch.quotas")


def check_quota(end_user_id: str, *, endpoint: str | None = None, api_key: str | None = None) -> bool:
    """Pre-execution quota guard. Queries sliding window usage for end_user_id.

    Raises QuotaExceeded if the end user has hit daily request or cost thresholds.
    """
    if not end_user_id:
        return True

    cfg = get_config()
    target_endpoint = (endpoint or cfg.endpoint).rstrip("/")
    target_key = api_key or cfg.api_key

    url = f"{target_endpoint}/v1/quotas/check?end_user_id={end_user_id}"
    try:
        with httpx.Client(timeout=4.0) as client:
            res = client.get(url, headers={"Authorization": f"Bearer {target_key}"})
            if res.status_code == 200:
                data = res.json()
                if not data.get("allowed", True):
                    reason = data.get("reason", "Daily request or cost quota limit reached.")
                    raise QuotaExceeded(f"Quota exceeded for customer '{end_user_id}': {reason}")
                return True
            elif res.status_code == 429:
                detail = res.json().get("detail") or "Quota exceeded."
                raise QuotaExceeded(f"Quota exceeded for customer '{end_user_id}': {detail}")
    except QuotaExceeded:
        raise
    except Exception as e:
        logger.debug("Quota check request failed (allowing request): %s", e)
        return True

    return True
