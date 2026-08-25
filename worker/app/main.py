import json
import logging
import os
import threading
import time
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Any

import clickhouse_connect
import psycopg
from redis import Redis
from redis.exceptions import ResponseError

from circuit_breaker import CircuitBreakerEngine
from drift_detector import ScopeDriftDetector
from eval_engine import EvalEngine
from pii_engine import PiiEngine, PiiMapping

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("agentwatch.worker")
STREAM = "spans:incoming"
DEAD_LETTER_STREAM = "spans:dead-letter"
GROUP = os.getenv("CONSUMER_GROUP", "clickhouse-writers")
CONSUMER = os.getenv("CONSUMER_NAME", "worker-1")
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "100"))
FIELDS = ["trace_id", "span_id", "parent_span_id", "agent_id", "parent_agent_id", "org_id", "session_id", "user_id", "end_user_id", "consent_id", "name", "span_type", "input", "output", "model", "prompt_tokens", "completion_tokens", "cost_usd", "latency_ms", "injection_risk_score", "injection_flags", "status", "error_message", "started_at", "ended_at", "metadata"]

eval_engine: EvalEngine | None = None
circuit_breaker_engine: CircuitBreakerEngine | None = None
drift_detector: ScopeDriftDetector | None = None
pii_engine: PiiEngine | None = None


def get_drift_detector() -> ScopeDriftDetector:
    global drift_detector
    if drift_detector is None:
        drift_detector = ScopeDriftDetector()
    return drift_detector


def get_circuit_breaker_engine() -> CircuitBreakerEngine:
    global circuit_breaker_engine
    if circuit_breaker_engine is None:
        circuit_breaker_engine = CircuitBreakerEngine()
    return circuit_breaker_engine


def get_pii_engine() -> PiiEngine:
    global pii_engine
    if pii_engine is None:
        pii_engine = PiiEngine(os.environ["PII_FERNET_KEY"])
    return pii_engine


def mask_span(span: dict[str, Any]) -> tuple[dict[str, Any], list[PiiMapping]]:
    masked = span.copy()
    engine = get_pii_engine()
    masked_payload, mappings = engine.mask_json({"input": span.get("input"), "output": span.get("output")})
    masked["input"], masked["output"] = masked_payload["input"], masked_payload["output"]
    return masked, mappings


def span_row(span: dict[str, Any]) -> list[Any]:
    return [json.dumps(span.get(key)) if key in {"input", "output", "metadata"} and span.get(key) is not None else span.get(key) for key in FIELDS]


def persist_mappings(spans_and_mappings: list[tuple[dict[str, Any], list[PiiMapping]]]) -> None:
    rows = [(span["org_id"], span["span_id"], mapping.token, mapping.encrypted_value) for span, mappings in spans_and_mappings for mapping in mappings]
    if not rows:
        return
    with psycopg.connect(os.getenv("DATABASE_URL", "postgresql://agentwatch:agentwatch@localhost:5432/agentwatch")) as conn:
        with conn.cursor() as cursor:
            cursor.executemany("INSERT INTO pii_mappings (org_id, span_id, token, encrypted_value) VALUES (%s, %s, %s, %s)", rows)


def get_eval_engine() -> EvalEngine:
    global eval_engine
    if eval_engine is None:
        eval_engine = EvalEngine(os.getenv("DATABASE_URL", "postgresql://agentwatch:agentwatch@localhost:5432/agentwatch"))
    return eval_engine


def process_entries(redis: Redis, entries: list[tuple[str, dict[str, str]]]) -> None:
    if not entries:
        return
    clickhouse = clickhouse_connect.get_client(host=os.getenv("CLICKHOUSE_HOST", "localhost"), username=os.getenv("CLICKHOUSE_USER", "agentwatch"), password=os.getenv("CLICKHOUSE_PASSWORD", "agentwatch"), database="agentwatch")
    try:
        spans_and_mappings = [mask_span(json.loads(values["span"])) for _, values in entries]
        persist_mappings(spans_and_mappings)
        clickhouse.insert("spans", [span_row(span) for span, _ in spans_and_mappings], column_names=FIELDS)

        # Trigger automated evaluation checks
        try:
            engine = get_eval_engine()
            all_scores: list[dict[str, Any]] = []
            for span, _ in spans_and_mappings:
                configs = engine.fetch_active_configs(span["org_id"], span.get("agent_id"))
                for cfg in configs:
                    score = engine.evaluate_span(span, cfg)
                    if score:
                        all_scores.append(score)
            if all_scores:
                engine.persist_scores(all_scores)
        except Exception as eval_exc:
            logger.debug("Automated eval execution warning: %s", eval_exc)

    except Exception as exc:
        logger.exception("ClickHouse insert failed; moving %d spans to dead letter", len(entries))
        pipeline = redis.pipeline()
        for message_id, values in entries:
            pipeline.xadd(DEAD_LETTER_STREAM, {"original_id": message_id, "span": values["span"], "error": str(exc)})
            pipeline.xack(STREAM, GROUP, message_id)
        pipeline.execute()
        return
    redis.xack(STREAM, GROUP, *(message_id for message_id, _ in entries))


def enforce_retention_policies() -> None:
    """Enforce data retention policies per organization across ClickHouse and Postgres."""
    logger.info("Running scheduled data retention policy enforcement")
    db_url = os.getenv("DATABASE_URL", "postgresql://agentwatch:agentwatch@localhost:5432/agentwatch")
    try:
        with psycopg.connect(db_url) as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT id, retention_days FROM orgs WHERE retention_days > 0")
                org_policies = cursor.fetchall()
    except Exception as exc:
        logger.warning("Could not query org retention policies: %s", exc)
        return

    if not org_policies:
        logger.debug("No active org retention policies configured")
        return

    try:
        clickhouse = clickhouse_connect.get_client(
            host=os.getenv("CLICKHOUSE_HOST", "localhost"),
            username=os.getenv("CLICKHOUSE_USER", "agentwatch"),
            password=os.getenv("CLICKHOUSE_PASSWORD", "agentwatch"),
            database="agentwatch",
        )
    except Exception as exc:
        logger.warning("ClickHouse unavailable for retention enforcement: %s", exc)
        clickhouse = None

    for org_id, retention_days in org_policies:
        org_id_str = str(org_id)
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=retention_days)
        cutoff_iso = cutoff_date.strftime("%Y-%m-%d %H:%M:%S")

        # 1. Hard-delete expired ClickHouse spans
        if clickhouse is not None:
            try:
                logger.info("Purging ClickHouse spans for org %s older than %s (%d days)", org_id_str, cutoff_iso, retention_days)
                clickhouse.command(
                    f"ALTER TABLE spans DELETE WHERE org_id = '{org_id_str}' AND started_at < '{cutoff_iso}'"
                )
            except Exception as exc:
                logger.error("Failed to delete ClickHouse spans for org %s: %s", org_id_str, exc)

        # 2. Hard-delete expired Postgres PII mappings
        try:
            with psycopg.connect(db_url) as conn:
                with conn.cursor() as cursor:
                    cursor.execute(
                        "DELETE FROM pii_mappings WHERE org_id = %s AND created_at < %s",
                        (org_id_str, cutoff_date),
                    )
                    logger.info("Purged %d expired PII mappings for org %s", cursor.rowcount, org_id_str)
        except Exception as exc:
            logger.error("Failed to delete Postgres PII mappings for org %s: %s", org_id_str, exc)

    logger.info("Retention policy enforcement cycle completed")


def enforce_monthly_usage_metering() -> None:
    """Monthly span usage metering against ClickHouse and plan-tier feature synchronization."""
    logger.info("Running monthly span usage metering job")
    db_url = os.getenv("DATABASE_URL", "postgresql://agentwatch:agentwatch@localhost:5432/agentwatch")
    try:
        with psycopg.connect(db_url) as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT id, plan_tier, monthly_spans_limit, retention_days FROM orgs")
                orgs = cursor.fetchall()
    except Exception as exc:
        logger.warning("Could not query orgs for metering: %s", exc)
        return

    if not orgs:
        return

    try:
        clickhouse = clickhouse_connect.get_client(
            host=os.getenv("CLICKHOUSE_HOST", "localhost"),
            username=os.getenv("CLICKHOUSE_USER", "agentwatch"),
            password=os.getenv("CLICKHOUSE_PASSWORD", "agentwatch"),
            database="agentwatch",
        )
    except Exception as exc:
        logger.warning("ClickHouse unavailable for usage metering: %s", exc)
        return

    PLAN_LIMITS = {
        "free": {"retention_days": 7, "spans_limit": 50_000},
        "pro": {"retention_days": 30, "spans_limit": 1_000_000},
        "team": {"retention_days": 90, "spans_limit": 10_000_000},
    }

    for org_id, plan_tier, current_limit, current_retention in orgs:
        org_id_str = str(org_id)
        tier = (plan_tier or "free").lower()
        tier_defaults = PLAN_LIMITS.get(tier, PLAN_LIMITS["free"])

        # Sync plan tier default limits if mismatched
        if current_retention != tier_defaults["retention_days"] or current_limit != tier_defaults["spans_limit"]:
            try:
                with psycopg.connect(db_url) as conn:
                    with conn.cursor() as cursor:
                        cursor.execute(
                            "UPDATE orgs SET retention_days = %s, monthly_spans_limit = %s WHERE id = %s",
                            (tier_defaults["retention_days"], tier_defaults["spans_limit"], org_id),
                        )
                        logger.info("Updated org %s limits to match tier %s (retention=%dd, limit=%d)", org_id_str, tier, tier_defaults["retention_days"], tier_defaults["spans_limit"])
            except Exception as exc:
                logger.error("Failed to sync limits for org %s: %s", org_id_str, exc)

        # Meter ClickHouse spans in current calendar month
        try:
            res = clickhouse.query(f"SELECT count() FROM spans WHERE org_id = '{org_id_str}' AND started_at >= toStartOfMonth(now())")
            count = res.result_rows[0][0] if res.result_rows else 0
            limit = current_limit or tier_defaults["spans_limit"]
            usage_pct = (count / limit) * 100 if limit > 0 else 0
            if usage_pct >= 90.0:
                logger.warning("Organization %s is at %.1f%% of monthly span limit (%d / %d)", org_id_str, usage_pct, count, limit)
        except Exception as exc:
            logger.warning("Failed to count spans for org %s: %s", org_id_str, exc)

    logger.info("Monthly usage metering job completed")


def fire_slack_webhook(webhook_url: str, org_id: str, condition_type: str, threshold: float, observed: float, window_mins: int) -> None:
    """Send formatted Slack alert on rule breach."""
    payload = {
        "text": f"🚨 *AgentWatch Alert Breach:* `{condition_type}` for Org `{org_id}`",
        "blocks": [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": "🚨 AgentWatch Alert Rule Breached"},
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Organization:*\n`{org_id}`"},
                    {"type": "mrkdwn", "text": f"*Condition:*\n`{condition_type}`"},
                    {"type": "mrkdwn", "text": f"*Threshold:*\n`{threshold}`"},
                    {"type": "mrkdwn", "text": f"*Observed Value:*\n`{observed}`"},
                    {"type": "mrkdwn", "text": f"*Window:*\n{window_mins} minutes"},
                    {"type": "mrkdwn", "text": f"*Triggered At:*\n{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}"},
                ],
            },
        ],
    }
    req = urllib.request.Request(
        webhook_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": "AgentWatch-RulesEngine/1.0"},
    )
    with urllib.request.urlopen(req, timeout=5.0) as resp:
        logger.info("Fired Slack alert to %s, response status: %s", webhook_url, resp.status)


def evaluate_alert_rules() -> None:
    """Evaluate alert rules against recent ClickHouse aggregates and fire Slack webhooks on breach."""
    db_url = os.getenv("DATABASE_URL", "postgresql://agentwatch:agentwatch@localhost:5432/agentwatch")
    try:
        with psycopg.connect(db_url) as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    "SELECT id, org_id, condition_type, threshold, webhook_url, window_minutes, last_triggered_at FROM alert_rules WHERE is_enabled = TRUE"
                )
                rules = cursor.fetchall()
    except Exception as exc:
        logger.debug("Could not query alert rules: %s", exc)
        return

    if not rules:
        return

    try:
        clickhouse = clickhouse_connect.get_client(
            host=os.getenv("CLICKHOUSE_HOST", "localhost"),
            username=os.getenv("CLICKHOUSE_USER", "agentwatch"),
            password=os.getenv("CLICKHOUSE_PASSWORD", "agentwatch"),
            database="agentwatch",
        )
    except Exception as exc:
        logger.warning("ClickHouse unavailable for alert rule evaluation: %s", exc)
        return

    now = datetime.now(timezone.utc)

    for rule_id, org_id, condition_type, threshold, webhook_url, window_minutes, last_triggered in rules:
        window_minutes = window_minutes or 15
        # Prevent repeating alerts within cooldown window
        if last_triggered and (now - last_triggered).total_seconds() < (window_minutes * 60):
            continue

        breached = False
        observed_val = 0.0

        try:
            if condition_type == "error_rate_spike":
                query = f"SELECT countIf(status = 'error') as errors, count() as total FROM spans WHERE org_id = '{org_id}' AND started_at >= now() - INTERVAL {window_minutes} MINUTE"
                res = clickhouse.query(query)
                if res.result_rows and res.result_rows[0][1] >= 5:
                    errors, total = res.result_rows[0]
                    observed_val = round(errors / total, 4)
                    breached = observed_val >= threshold

            elif condition_type == "cost_spike":
                query = f"SELECT sum(cost_usd) as total_cost FROM spans WHERE org_id = '{org_id}' AND started_at >= now() - INTERVAL {window_minutes} MINUTE"
                res = clickhouse.query(query)
                if res.result_rows and res.result_rows[0][0] is not None:
                    observed_val = round(float(res.result_rows[0][0]), 4)
                    breached = observed_val >= threshold

            elif condition_type == "latency_spike":
                query = f"SELECT quantile(0.95)(toUInt64(ifNull(latency_ms, 0))) as p95 FROM spans WHERE org_id = '{org_id}' AND started_at >= now() - INTERVAL {window_minutes} MINUTE"
                res = clickhouse.query(query)
                if res.result_rows and res.result_rows[0][0] is not None:
                    observed_val = round(float(res.result_rows[0][0]), 2)
                    breached = observed_val >= threshold

            elif condition_type == "unauthorized_tool_call":
                query = f"SELECT count() as unauth FROM spans WHERE org_id = '{org_id}' AND span_type = 'tool_call' AND status = 'error' AND error_message LIKE '%PolicyViolation%' AND started_at >= now() - INTERVAL {window_minutes} MINUTE"
                res = clickhouse.query(query)
                if res.result_rows and res.result_rows[0][0] is not None:
                    observed_val = float(res.result_rows[0][0])
                    breached = observed_val >= threshold

            if breached:
                logger.warning("ALERT BREACH: Org %s, Condition %s, Threshold %f, Observed %f", org_id, condition_type, threshold, observed_val)
                try:
                    fire_slack_webhook(webhook_url, org_id, condition_type, threshold, observed_val, window_minutes)
                except Exception as exc:
                    logger.error("Failed to fire Slack webhook for rule %s: %s", rule_id, exc)

                with psycopg.connect(db_url) as conn:
                    with conn.cursor() as cursor:
                        cursor.execute("UPDATE alert_rules SET last_triggered_at = NOW() WHERE id = %s", (rule_id,))
                        cursor.execute(
                            "INSERT INTO audit_log (org_id, api_key_hash, action, span_id, details) VALUES (%s, 'system', 'alert_triggered', NULL, %s::jsonb)",
                            (org_id, json.dumps({"rule_id": rule_id, "condition": condition_type, "threshold": threshold, "observed": observed_val})),
                        )
        except Exception as exc:
            logger.error("Error evaluating alert rule %s: %s", rule_id, exc)


def evaluate_circuit_breakers() -> None:
    """Evaluate 5-minute cost runaway burn rates across organizations."""
    db_url = os.getenv("DATABASE_URL", "postgresql://agentwatch:agentwatch@localhost:5432/agentwatch")
    try:
        with psycopg.connect(db_url) as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT id, max_cost_velocity_5m, emergency_webhook_url FROM orgs WHERE is_throttled = FALSE")
                orgs = cursor.fetchall()
    except Exception:
        return

    if not orgs:
        return

    try:
        clickhouse = clickhouse_connect.get_client(
            host=os.getenv("CLICKHOUSE_HOST", "localhost"),
            username=os.getenv("CLICKHOUSE_USER", "agentwatch"),
            password=os.getenv("CLICKHOUSE_PASSWORD", "agentwatch"),
            database="agentwatch",
        )
    except Exception:
        return

    for org_id, max_velocity, webhook_url in orgs:
        org_id_str = str(org_id)
        max_cost = float(max_velocity or 50.0)
        try:
            res = clickhouse.query(
                f"SELECT sum(ifNull(cost_usd, 0)) FROM spans WHERE org_id = '{org_id_str}' AND started_at >= now() - INTERVAL 5 MINUTE"
            )
            if res.result_rows and res.result_rows[0][0] is not None:
                cost_5m = float(res.result_rows[0][0])
                if cost_5m > max_cost:
                    logger.error("🚨 COST RUNAWAY DETECTED: Org %s reached $%s in 5m (limit $%s)", org_id_str, cost_5m, max_cost)
                    reason = f"5-Minute cost velocity (${cost_5m:.2f}) exceeded runaway threshold (${max_cost:.2f})"
                    with psycopg.connect(db_url) as conn:
                        with conn.cursor() as cursor:
                            cursor.execute("UPDATE orgs SET is_throttled = TRUE, throttled_reason = %s, throttled_at = NOW() WHERE id = %s", (reason, org_id))
                            cursor.execute(
                                "INSERT INTO circuit_breaker_events (org_id, agent_id, trigger_type, cost_at_trigger, loop_count, details, action_taken) VALUES (%s, NULL, 'cost_velocity_spike', %s, 0, %s::jsonb, 'throttled')",
                                (org_id_str, cost_5m, json.dumps({"reason": reason})),
                            )
                    # Notify Slack/PagerDuty webhook if configured
                    if webhook_url:
                        try:
                            payload = {
                                "text": f"🚨 *EMERGENCY: AgentWatch Circuit Breaker Tripped*\n*Org ID*: `{org_id_str}`\n*Trigger*: `cost_velocity_spike`\n*Reason*: {reason}\n*Action*: Traffic Throttled (HTTP 429)",
                                "org_id": org_id_str,
                                "trigger_type": "cost_velocity_spike",
                                "cost_usd": cost_5m,
                                "action": "throttled",
                            }
                            req = urllib.request.Request(
                                webhook_url,
                                data=json.dumps(payload).encode("utf-8"),
                                headers={"Content-Type": "application/json", "User-Agent": "AgentWatch-CircuitBreaker/1.0"},
                            )
                            urllib.request.urlopen(req, timeout=5.0)
                        except Exception as w_exc:
                            logger.warning("Failed to fire emergency webhook: %s", w_exc)
        except Exception as exc:
            logger.debug("Error in circuit breaker cost velocity evaluation: %s", exc)


def circuit_breaker_loop(interval_seconds: int = 30) -> None:
    while True:
        try:
            evaluate_circuit_breakers()
        except Exception:
            logger.exception("Unexpected error in circuit breaker evaluation loop")
        time.sleep(interval_seconds)


def alert_evaluation_loop(interval_seconds: int = 60) -> None:
    while True:
        try:
            evaluate_alert_rules()
        except Exception:
            logger.exception("Unexpected error in alert rules evaluation loop")
        time.sleep(interval_seconds)


def retention_scheduler_loop(interval_seconds: int = 3600) -> None:
    while True:
        try:
            enforce_retention_policies()
            enforce_monthly_usage_metering()
        except Exception:
            logger.exception("Unexpected error during maintenance/metering cycle")
        time.sleep(interval_seconds)


def recover_pending(redis: Redis) -> None:
    """Claim entries left by a crashed consumer, then process them normally."""
    try:
        cursor = "0-0"
        while True:
            cursor, claimed, _ = redis.xautoclaim(STREAM, GROUP, CONSUMER, min_idle_time=60_000, start_id=cursor, count=BATCH_SIZE)
            process_entries(redis, claimed)
            if cursor == "0-0":
                break
    except ResponseError:
        return


def main() -> None:
    redis = Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"), decode_responses=True)
    try:
        redis.xgroup_create(STREAM, GROUP, id="0", mkstream=True)
    except ResponseError as exc:
        if "BUSYGROUP" not in str(exc):
            raise
    recover_pending(redis)

    # Start periodic retention cleaner daemon
    retention_interval = int(os.getenv("RETENTION_CHECK_INTERVAL_SECONDS", "3600"))
    retention_thread = threading.Thread(
        target=retention_scheduler_loop,
        args=(retention_interval,),
        name="retention-enforcer",
        daemon=True,
    )
    retention_thread.start()

    # Start 1-minute alert rules evaluation daemon
    alert_thread = threading.Thread(
        target=alert_evaluation_loop,
        args=(60,),
        name="alert-evaluator",
        daemon=True,
    )
    alert_thread.start()

    # Start 30-second automated circuit breaker monitor daemon
    cb_thread = threading.Thread(
        target=circuit_breaker_loop,
        args=(30,),
        name="circuit-breaker-evaluator",
        daemon=True,
    )
    cb_thread.start()

    while True:
        messages = redis.xreadgroup(GROUP, CONSUMER, {STREAM: ">"}, count=BATCH_SIZE, block=5_000)
        for _, entries in messages:
            process_entries(redis, entries)
        time.sleep(0.01)


if __name__ == "__main__":
    main()
