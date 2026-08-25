const { Client } = require("pg");

const connectionString = "postgresql://neondb_owner:npg_GKQi0oSMckg5@ep-wild-star-axlwauui.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function patchSSO() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  await client.query(`
    ALTER TABLE orgs ADD COLUMN IF NOT EXISTS sso_enabled BOOLEAN DEFAULT FALSE;
    ALTER TABLE orgs ADD COLUMN IF NOT EXISTS sso_provider_config JSONB DEFAULT '{}'::jsonb;
    
    CREATE TABLE IF NOT EXISTS sso_connections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id VARCHAR(255) NOT NULL,
      provider VARCHAR(64) NOT NULL,
      idp_metadata_url TEXT,
      idp_entity_id TEXT,
      idp_sso_url TEXT,
      certificate_fingerprint TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  console.log("✅ SSO schema synchronized with Neon!");
  await client.end();
}

patchSSO().catch(console.error);
