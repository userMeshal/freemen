"use server";

import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { merchants, stores } from "@/db/schema";
import { clientIp, endSession, startMerchantSession } from "@/lib/auth";
import { normalizePhone } from "@/lib/money";
import { hashPassword, verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { draftTokens } from "@/lib/stores";

export type AuthState = { error: string } | null;

const Signup = z.object({
  name: z.string().trim().min(3, "اكتب اسمك").max(60),
  phone: z.string().trim().min(9).max(20),
  password: z.string().min(8, "كلمة المرور 8 أحرف على الأقل").max(100),
});

/** ينشئ حساب التاجر، ويربط به مسودة المتجر التي بناها في المحادثة وينشرها فورًا */
export async function signupAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const parsed = Signup.safeParse({ name: form.get("name"), phone: form.get("phone"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "تحقق من البيانات" };
  const phone = normalizePhone(parsed.data.phone);
  if (!phone) return { error: "رقم الجوال غير صحيح — اكتبه بصيغة 05XXXXXXXX" };
  if (!(await rateLimit(`signup:${await clientIp()}`, 10, 3600))) return { error: "محاولات كثيرة — جرّب بعد ساعة" };

  const existing = await db.select({ id: merchants.id }).from(merchants).where(eq(merchants.phone, phone)).limit(1);
  if (existing.length) return { error: "هذا الرقم مسجّل من قبل — سجّل دخولك" };

  const tokens = await draftTokens();
  const [merchant] = await db
    .insert(merchants)
    .values({ name: parsed.data.name, phone, passwordHash: await hashPassword(parsed.data.password) })
    .returning();

  let claimed = false;
  if (tokens.length) {
    const drafts = await db
      .select({ id: stores.id })
      .from(stores)
      .where(and(inArray(stores.claimToken, tokens), eq(stores.status, "draft"), isNull(stores.merchantId)))
      .orderBy(desc(stores.id))
      .limit(1);
    if (drafts[0]) {
      await db
        .update(stores)
        .set({ merchantId: merchant.id, status: "live", claimToken: null, bankHolder: parsed.data.name, updatedAt: new Date() })
        .where(and(eq(stores.id, drafts[0].id), isNull(stores.merchantId)));
      claimed = true;
    }
  }
  await startMerchantSession(merchant.id, merchant.name);
  redirect(claimed ? "/dashboard?welcome=1" : "/start");
}

export async function loginAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const phone = normalizePhone(String(form.get("phone") ?? ""));
  const password = String(form.get("password") ?? "");
  if (!phone || !password) return { error: "اكتب رقم الجوال وكلمة المرور" };
  if (!(await rateLimit(`login:${phone}`, 8, 900)) || !(await rateLimit(`login-ip:${await clientIp()}`, 30, 900))) {
    return { error: "محاولات كثيرة — جرّب بعد ربع ساعة" };
  }
  const rows = await db.select().from(merchants).where(eq(merchants.phone, phone)).limit(1);
  // نتحقق من كلمة المرور حتى لو لم يوجد الحساب، حتى لا يكشف زمن الرد وجود الرقم
  const ok = await verifyPassword(password, rows[0]?.passwordHash ?? "scrypt$00$00");
  if (!rows[0] || !ok) return { error: "رقم الجوال أو كلمة المرور غير صحيحة" };
  await startMerchantSession(rows[0].id, rows[0].name);
  redirect("/dashboard");
}

export async function logoutAction() {
  await endSession("merchant");
  redirect("/");
}
