"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { coupons } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { toLatinDigits } from "@/lib/normalize";
import { bool, fail, firstError, intOrNull, ok, riyadhLocalToDate, sarToHalalas, str, type ActionState } from "@/lib/admin-utils";

const schema = z.object({
  code: z
    .string()
    .min(2, "رمز الكوبون قصير جدًا")
    .max(40, "رمز الكوبون طويل جدًا")
    .regex(/^[A-Z0-9_-]+$/, "رمز الكوبون: أحرف إنجليزية وأرقام و - _ فقط"),
  type: z.enum(["percent", "fixed", "free_shipping"], { message: "اختر نوع الكوبون" }),
});

export async function saveCouponAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = schema.safeParse({ code: toLatinDigits(str(fd, "code")).toUpperCase(), type: str(fd, "type") });
  if (!parsed.success) return fail(firstError(parsed.error));
  const { code, type } = parsed.data;

  let value = 0;
  let maxDiscount: number | null = null;
  if (type === "percent") {
    const n = intOrNull(str(fd, "value"));
    if (n === null || Number.isNaN(n) || n < 1 || n > 100) return fail("نسبة الخصم يجب أن تكون رقمًا صحيحًا بين 1 و 100");
    value = n;
    maxDiscount = sarToHalalas(str(fd, "maxDiscount"));
    if (Number.isNaN(maxDiscount)) return fail("الحد الأقصى للخصم غير صالح");
    if (maxDiscount !== null && maxDiscount <= 0) maxDiscount = null;
  } else if (type === "fixed") {
    const n = sarToHalalas(str(fd, "value"));
    if (n === null || Number.isNaN(n) || n <= 0) return fail("قيمة الخصم (ر.س) مطلوبة ويجب أن تكون أكبر من صفر");
    value = n;
  }
  const minSubtotal = sarToHalalas(str(fd, "minSubtotal")) ?? 0;
  if (Number.isNaN(minSubtotal)) return fail("الحد الأدنى للطلب غير صالح");
  const usageLimit = intOrNull(str(fd, "usageLimit"));
  if (Number.isNaN(usageLimit)) return fail("حد الاستخدام يجب أن يكون رقمًا صحيحًا");

  const startsRaw = str(fd, "startsAt");
  const endsRaw = str(fd, "endsAt");
  const startsAt = riyadhLocalToDate(startsRaw);
  const endsAt = riyadhLocalToDate(endsRaw);
  if (startsRaw && !startsAt) return fail("تاريخ البداية غير صالح");
  if (endsRaw && !endsAt) return fail("تاريخ النهاية غير صالح");
  if (startsAt && endsAt && endsAt <= startsAt) return fail("تاريخ النهاية يجب أن يكون بعد تاريخ البداية");

  const rawId = str(fd, "id");
  const id = rawId ? Number(rawId) : null;
  if (id !== null && (!Number.isInteger(id) || id <= 0)) return fail("كوبون غير صالح");

  const clash = await db
    .select({ id: coupons.id })
    .from(coupons)
    .where(id ? and(eq(coupons.code, code), ne(coupons.id, id)) : eq(coupons.code, code))
    .limit(1);
  if (clash.length) return fail("يوجد كوبون آخر بنفس الرمز");

  const values = {
    code,
    type,
    value,
    minSubtotal,
    maxDiscount,
    usageLimit: usageLimit !== null && usageLimit > 0 ? usageLimit : null,
    startsAt,
    endsAt,
    isActive: bool(fd, "isActive"),
  };
  if (id) {
    const res = await db.update(coupons).set(values).where(eq(coupons.id, id)).returning({ id: coupons.id });
    if (!res.length) return fail("الكوبون غير موجود");
  } else {
    await db.insert(coupons).values(values);
  }
  revalidatePath("/admin/coupons");
  return ok(id ? "تم حفظ الكوبون" : `تم إنشاء الكوبون ${code}`);
}

export async function deleteCouponAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = z.coerce.number().int().positive().safeParse(fd.get("id"));
  if (!parsed.success) return fail("كوبون غير صالح");
  await db.delete(coupons).where(eq(coupons.id, parsed.data));
  revalidatePath("/admin/coupons");
  return ok("تم حذف الكوبون");
}
