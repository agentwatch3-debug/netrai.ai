-- 005_billing.sql: Razorpay Subscription Billing & Plan Tiers

ALTER TABLE orgs ADD COLUMN IF NOT EXISTS plan_tier VARCHAR(32) NOT NULL DEFAULT 'free';
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS razorpay_customer_id TEXT NULL;
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS razorpay_subscription_id TEXT NULL;
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(32) NOT NULL DEFAULT 'none';
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ NULL;
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS monthly_spans_limit BIGINT NOT NULL DEFAULT 50000;

CREATE INDEX IF NOT EXISTS orgs_subscription_id_idx ON orgs (razorpay_subscription_id) WHERE razorpay_subscription_id IS NOT NULL;
