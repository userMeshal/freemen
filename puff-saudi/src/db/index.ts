import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { __puffSql?: ReturnType<typeof postgres> };

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL غير مضبوط — أضفه في متغيرات البيئة");
  const isLocal = /localhost|127\.0\.0\.1/.test(url);
  return postgres(url, {
    max: isLocal ? 10 : 5,
    idle_timeout: 20,
    connect_timeout: 15,
    // متوافق مع الـ connection poolers (Neon / Supabase pgbouncer)
    prepare: false,
    ssl: isLocal ? false : "require",
  });
}

export const sql = globalForDb.__puffSql ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.__puffSql = sql;

export const db = drizzle(sql, { schema });
export { schema };
export type DB = typeof db;
