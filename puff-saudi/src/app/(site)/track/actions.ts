"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { clientIp } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeSaudiPhone, toLatinDigits } from "@/lib/normalize";

export type TrackState = { error?: string };

export async function trackAction(_prev: TrackState, formData: FormData): Promise<TrackState> {
  const ip = await clientIp();
  if (!(await rateLimit(`track:${ip}`, 80, 600))) return { error: "محاولات كثيرة. انتظر بضع دقائق ثم أعد المحاولة." };

  const number = toLatinDigits(String(formData.get("number") ?? ""))
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 20);
  const phone = normalizeSaudiPhone(String(formData.get("phone") ?? ""));
  if (!number || !phone) return { error: "أدخل رقم الطلب ورقم الجوال المستخدم في الطلب." };
  // حد لكل رقم جوال: يمنع تخمين أرقام الطلبات لرقم معروف، دون التأثير على من يتشاركون عنوان الشبكة
  if (!(await rateLimit(`track-phone:${phone}`, 6, 1800))) return { error: "محاولات كثيرة لهذا الرقم. انتظر نصف ساعة ثم أعد المحاولة." };

  const candidates = [number, number.startsWith("PF") ? number : `PF${number}`];
  for (const n of candidates) {
    const rows = await db
      .select({ number: orders.number, token: orders.accessToken })
      .from(orders)
      .where(and(eq(orders.number, n), eq(orders.customerPhone, phone)))
      .limit(1);
    if (rows[0]) redirect(`/order/${rows[0].number}?t=${rows[0].token}`);
  }
  return { error: "لم نجد طلبًا بهذه البيانات. تأكد من رقم الطلب ورقم الجوال." };
}
