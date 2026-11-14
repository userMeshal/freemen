import { loadEnvConfig } from "@next/env";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

loadEnvConfig(process.cwd());

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("✗ DATABASE_URL غير مضبوط");
    process.exit(1);
  }
  const isLocal = /localhost|127\.0\.0\.1/.test(url);
  const sql = postgres(url, { max: 1, ssl: isLocal ? false : "require", onnotice: () => {} });
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  await sql.end();
  console.log("✓ تم تطبيق ترحيلات قاعدة البيانات");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
