-- 014_golden_datasets.sql: Golden Datasets, Test Cases, and Pre-Deploy Test Runs

CREATE TABLE IF NOT EXISTS golden_datasets
(
    id BIGSERIAL PRIMARY KEY,
    org_id TEXT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS golden_cases
(
    id BIGSERIAL PRIMARY KEY,
    dataset_id BIGINT NOT NULL REFERENCES golden_datasets(id) ON DELETE CASCADE,
    case_id VARCHAR(64) NOT NULL,
    input JSONB NOT NULL,
    eval_type VARCHAR(32) NOT NULL DEFAULT 'exact', -- 'exact' | 'semantic' | 'llm_judge'
    expected_output JSONB NULL,
    expected_criteria TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS test_runs
(
    id BIGSERIAL PRIMARY KEY,
    org_id TEXT NOT NULL,
    dataset_id BIGINT NULL REFERENCES golden_datasets(id),
    dataset_name VARCHAR(255) NOT NULL,
    git_commit VARCHAR(64) NULL,
    git_branch VARCHAR(64) NULL,
    total_cases INT NOT NULL,
    passed_cases INT NOT NULL,
    failed_cases INT NOT NULL,
    has_regressions BOOLEAN NOT NULL DEFAULT FALSE,
    results JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS golden_datasets_org_idx ON golden_datasets (org_id, name);
CREATE INDEX IF NOT EXISTS golden_cases_dataset_idx ON golden_cases (dataset_id, case_id);
CREATE INDEX IF NOT EXISTS test_runs_dataset_idx ON test_runs (org_id, dataset_name, created_at DESC);
