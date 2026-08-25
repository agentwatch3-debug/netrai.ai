-- 008_prompts.sql: Centralized Prompt Management and Version Control

CREATE TABLE IF NOT EXISTS prompts
(
    id BIGSERIAL PRIMARY KEY,
    org_id TEXT NOT NULL,
    name VARCHAR(128) NOT NULL,
    description TEXT NULL,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, name)
);

CREATE INDEX IF NOT EXISTS prompts_org_name_idx ON prompts (org_id, name);

CREATE TABLE IF NOT EXISTS prompt_versions
(
    id BIGSERIAL PRIMARY KEY,
    prompt_id BIGINT NOT NULL REFERENCES prompts (id) ON DELETE CASCADE,
    org_id TEXT NOT NULL,
    version INT NOT NULL,
    template TEXT NOT NULL,
    model VARCHAR(128) NOT NULL DEFAULT 'gpt-4.1-mini',
    model_parameters JSONB DEFAULT '{}'::jsonb,
    labels TEXT[] DEFAULT '{}', -- e.g. '{"production"}', '{"staging"}'
    author TEXT NULL,
    commit_message TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (prompt_id, version)
);

CREATE INDEX IF NOT EXISTS prompt_versions_prompt_id_idx ON prompt_versions (prompt_id);
CREATE INDEX IF NOT EXISTS prompt_versions_org_labels_idx ON prompt_versions (org_id);
