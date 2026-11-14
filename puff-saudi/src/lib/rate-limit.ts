import "server-only";
import { sql as dsql } from "drizzle-orm";
import { db } from "@/db";

/**
 * محدِّد معدل مبني على قاعدة البيانات (يعمل على Vercel serverless حيث لا توجد ذاكرة مشتركة).
 * يرجع true إذا كان الطلب مسموحًا.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const rows = await db.execute<{ count: number }>(dsql`
    insert into rate_limits (key, count, reset_at)
    values (${key}, 1, now() + (${windowSeconds} || ' seconds')::interval)
    on conflict (key) do update set
      count = case when rate_limits.reset_at < now() then 1 else rate_limits.count + 1 end,
      reset_at = case when rate_limits.reset_at < now()
        then now() + (${windowSeconds} || ' seconds')::interval else rate_limits.reset_at end
    returning count
  `);
  const count = Number((rows as unknown as { count: number }[])[0]?.count ?? 1);
  return count <= limit;
}
