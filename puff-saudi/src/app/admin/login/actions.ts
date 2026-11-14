"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { admins } from "@/db/schema";
import { clientIp, startAdminSession } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { fail, str, type ActionState } from "@/lib/admin-utils";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
});

export async function loginAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ip = await clientIp();
  if (!(await rateLimit(`admin-login:${ip}`, 8, 900))) {
    return fail("محاولات كثيرة. حاول مجددًا بعد 15 دقيقة.");
  }
  const parsed = schema.safeParse({ email: str(fd, "email"), password: String(fd.get("password") ?? "") });
  if (!parsed.success) return fail("بيانات الدخول غير صحيحة");

  const rows = await db.select().from(admins).where(eq(admins.email, parsed.data.email)).limit(1);
  const admin = rows[0];
  // نتحقق دائمًا من كلمة المرور لتفادي كشف وجود البريد عبر التوقيت
  const valid = await verifyPassword(
    parsed.data.password,
    admin?.passwordHash ?? "scrypt$00000000000000000000000000000000$" + "0".repeat(128),
  );
  if (!admin || !valid) return fail("بيانات الدخول غير صحيحة");

  await startAdminSession(admin.id, admin.name);
  redirect("/admin");
}
