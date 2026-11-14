"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/dash/client";
import { clientIp, startHqSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().trim().toLowerCase().min(3).max(200),
  password: z.string().min(1).max(500),
});

const digest = (s: string) => createHash("sha256").update(s, "utf8").digest();
/** مقارنة ثابتة الزمن على بصمات SHA-256 حتى لا يتسرّب طول القيمة الصحيحة */
const safeEqual = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));

export async function loginHq(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ip = await clientIp();
  if (!(await rateLimit(`hq-login:${ip}`, 8, 15 * 60))) {
    return { ok: false, error: "محاولات كثيرة. انتظر ربع ساعة ثم حاول من جديد." };
  }

  const parsed = schema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { ok: false, error: "أدخل البريد وكلمة المرور" };

  const adminEmail = (process.env.ZAAR_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const adminPassword = process.env.ZAAR_ADMIN_PASSWORD ?? "";
  const configured = adminEmail.length > 0 && adminPassword.length >= 12;

  // نحسب المقارنتين دائمًا (بلا اختصار) حتى لا يكشف زمن الرد أيّهما الخاطئ
  const emailOk = safeEqual(parsed.data.email, adminEmail);
  const passwordOk = safeEqual(parsed.data.password, adminPassword);

  if (!configured) {
    console.error("[hq] رُفض الدخول: ZAAR_ADMIN_EMAIL غير مضبوط أو ZAAR_ADMIN_PASSWORD أقصر من 12 حرفًا");
    return { ok: false, error: "دخول الإدارة غير مفعّل على هذا الخادم." };
  }
  if (!emailOk || !passwordOk) return { ok: false, error: "بيانات الدخول غير صحيحة" };

  await startHqSession(adminEmail);
  redirect("/hq");
}
