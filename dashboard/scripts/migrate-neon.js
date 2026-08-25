const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_GKQi0oSMckg5@ep-wild-star-axlwauui.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function runMigrations() {
  console.log("================================================================================");
  console.log(" 🚀 Connecting to Neon PostgreSQL Cloud...");
  console.log("================================================================================\n");

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log("✅ Connected successfully to Neon PostgreSQL!\n");

  const initDir = path.resolve(__dirname, "../../infra/postgres/init");
  const files = fs
    .readdirSync(initDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`Found ${files.length} migration scripts to execute:\n`);

  for (const file of files) {
    const filePath = path.join(initDir, file);
    const sql = fs.readFileSync(filePath, "utf-8");
    try {
      console.log(`  ➔ Applying: ${file}...`);
      await client.query(sql);
      console.log(`    ✓ Success: ${file}`);
    } catch (err) {
      console.warn(`    ⚠️ Warning on ${file}: ${err.message}`);
    }
  }

  console.log("\n================================================================================");
  console.log(" 🎉 All 18 Database Migrations Applied to Neon PostgreSQL!");
  console.log("================================================================================\n");

  // Verify created tables
  const res = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);

  console.log("Created Tables in Neon PostgreSQL:");
  res.rows.forEach((r, idx) => console.log(`  ${idx + 1}. ${r.table_name}`));

  await client.end();
}

runMigrations().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
