-- 008_end_user.sql: Add end_user_id for customer-level quota and analytics tracking

ALTER TABLE spans ADD COLUMN IF NOT EXISTS end_user_id Nullable(String);
