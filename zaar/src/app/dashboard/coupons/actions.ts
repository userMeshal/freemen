"use server";

import { revalidatePath } from "next/cache";
import { and, eq, not, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { coupons } from "@/db/schema";
import type { ActionState } from "@/components/dash/client";
import { merchantStore } from "@/lib/auth";
import { latinDigits } from "@/lib/money";
import { NO_SESSION, done, fail, idOf, sar, text, zIntOptional, zSar, zodFail } from "../_lib/form";

const MAX_COUPONS = 200;

const CouponInput = z.object({
  code: z.string().regex(/^[A-Z0-9]{3,20}$/, "الكود: من 3 إلى 20 حرفًا إنجليزيًا أو رقمًا بدون مسافات"),
  type: z.enum(["percent", "fixed", "free_shipping"], "اختر نوع الخصم"),
  minSubtotal: zSar("الحد الأدنى للطلب"),
  maxUses: zIntOptional("عدد مرات الاستخدام", 1, 1000000),
  expires: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "تاريخ الانتهاء غير صحيح"),
});

export async function createCoupon(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await merchantStore();
  if (!ctx) return NO_SESSION;
  const { store } = ctx;

  const parsed = CouponInput.safeParse({
    code: latinDigits(text(form, "code", 30)).toUpperCase(),
    type: text(form, "type", 20),
    minSubtotal: text(form, "minSubtotal", 20) || "0",
    maxUses: text(form, "maxUses", 12),
    expires: text(form, "expires", 10),
  });
  if (!parsed.success) return zodFail(parsed.error);
  const input = parsed.data;

  let value = 0;
  const rawValue = latinDigits(text(form, "value", 20));
  if (input.type === "percent") {
    value = Number(rawValue);
    if (!/^\d{1,2}$/.test(rawValue) || value < 1 || value > 90) return fail("نسبة الخصم: رقم صحيح من 1 إلى 90");
  } else if (input.type === "fixed") {
    const amount = sar(rawValue);
    if (amount === null || amount < 100) return fail("مبلغ الخصم: اكتب مبلغًا صحيحًا بالريال (ريال واحد على الأقل)");
    value = amount;
  }

  let expiresAt: Date | null = null;
  if (input.expires) {
    // ينتهي الكوبون آخر اليوم المحدد بتوقيت الرياض
    expiresAt = new Date(`${input.expires}T23:59:59+03:00`);
    if (Number.isNaN(expiresAt.getTime())) return fail("تاريخ الانتهاء غير صحيح");
    if (expiresAt.getTime() < Date.now()) return fail("تاريخ الانتهاء لازم يكون اليوم أو بعده");
  }

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(coupons)
    .where(eq(coupons.storeId, store.id));
  if (n >= MAX_COUPONS) return fail("وصلت الحد الأقصى للكوبونات — احذف القديم منها أول");

  const rows = await db
    .insert(coupons)
    .values({ storeId: store.id, code: input.code, type: input.type, value, minSubtotal: input.minSubtotal, maxUses: input.maxUses, expiresAt })
    .onConflictDoNothing({ target: [coupons.storeId, coupons.code] })
    .returning({ id: coupons.id });
  if (!rows.length) return fail(`عندك كوبون بنفس الكود (${input.code})`);
  revalidatePath("/dashboard/coupons");
  return done(`تم إنشاء الكوبون ${input.code}`);
}

export async function toggleCoupon(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await merchantStore();
  if (!ctx) return NO_SESSION;
  const id = idOf(form);
  if (!id) return fail("كوبون غير معروف");
  const rows = await db
    .update(coupons)
    .set({ active: not(coupons.active) })
    .where(and(eq(coupons.id, id), eq(coupons.storeId, ctx.store.id)))
    .returning({ active: coupons.active });
  if (!rows.length) return fail("كوبون غير معروف");
  revalidatePath("/dashboard/coupons");
  return done(rows[0].active ? "تم تفعيل الكوبون" : "تم إيقاف الكوبون");
}

export async function deleteCoupon(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await merchantStore();
  if (!ctx) return NO_SESSION;
  const id = idOf(form);
  if (!id) return fail("كوبون غير معروف");
  const rows = await db
    .delete(coupons)
    .where(and(eq(coupons.id, id), eq(coupons.storeId, ctx.store.id)))
    .returning({ id: coupons.id });
  if (!rows.length) return fail("كوبون غير معروف");
  revalidatePath("/dashboard/coupons");
  return done("تم حذف الكوبون");
}
