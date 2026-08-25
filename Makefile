.PHONY: dev test migrate

dev:
	docker compose -f infra/docker-compose.yml -f infra/docker-compose.override.yml up --build

test:
	python -m pip install -r requirements-dev.txt
	PYTHONPATH=ingestion-api python -m pytest ingestion-api/tests
	PYTHONPATH=worker python -m pytest worker/tests

migrate:
	docker compose -f infra/docker-compose.yml exec -T postgres psql -U agentwatch -d agentwatch -f /docker-entrypoint-initdb.d/001_api_keys.sql
	docker compose -f infra/docker-compose.yml exec -T postgres psql -U agentwatch -d agentwatch -f /docker-entrypoint-initdb.d/002_pii.sql
	docker compose -f infra/docker-compose.yml exec -T postgres psql -U agentwatch -d agentwatch -f /docker-entrypoint-initdb.d/003_orgs.sql
	docker compose -f infra/docker-compose.yml exec -T postgres psql -U agentwatch -d agentwatch -f /docker-entrypoint-initdb.d/004_compliance.sql
	docker compose -f infra/docker-compose.yml exec -T postgres psql -U agentwatch -d agentwatch -f /docker-entrypoint-initdb.d/005_billing.sql
	docker compose -f infra/docker-compose.yml exec -T postgres psql -U agentwatch -d agentwatch -f /docker-entrypoint-initdb.d/006_rules.sql
	docker compose -f infra/docker-compose.yml exec -T postgres psql -U agentwatch -d agentwatch -f /docker-entrypoint-initdb.d/007_evals.sql
	docker compose -f infra/docker-compose.yml exec -T postgres psql -U agentwatch -d agentwatch -f /docker-entrypoint-initdb.d/008_prompts.sql
	docker compose -f infra/docker-compose.yml exec -T postgres psql -U agentwatch -d agentwatch -f /docker-entrypoint-initdb.d/009_circuit_breaker.sql
	docker compose -f infra/docker-compose.yml exec -T postgres psql -U agentwatch -d agentwatch -f /docker-entrypoint-initdb.d/010_injection_security.sql
	docker compose -f infra/docker-compose.yml exec -T postgres psql -U agentwatch -d agentwatch -f /docker-entrypoint-initdb.d/011_anomalies.sql
	docker compose -f infra/docker-compose.yml exec -T postgres psql -U agentwatch -d agentwatch -f /docker-entrypoint-initdb.d/012_consents.sql
	docker compose -f infra/docker-compose.yml exec -T postgres psql -U agentwatch -d agentwatch -f /docker-entrypoint-initdb.d/013_output_policies.sql
	docker compose -f infra/docker-compose.yml exec -T postgres psql -U agentwatch -d agentwatch -f /docker-entrypoint-initdb.d/014_golden_datasets.sql
	docker compose -f infra/docker-compose.yml exec -T postgres psql -U agentwatch -d agentwatch -f /docker-entrypoint-initdb.d/015_user_quotas.sql
	docker compose -f infra/docker-compose.yml exec -T postgres psql -U agentwatch -d agentwatch -f /docker-entrypoint-initdb.d/016_enterprise_sso.sql
	docker compose -f infra/docker-compose.yml exec -T postgres psql -U agentwatch -d agentwatch -f /docker-entrypoint-initdb.d/017_audit_log_tamper_evidence.sql
	docker compose -f infra/docker-compose.yml exec -T postgres psql -U agentwatch -d agentwatch -f /docker-entrypoint-initdb.d/018_subject_rights_requests.sql
