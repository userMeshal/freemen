"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { shippingMethods } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { bool, fail, firstError, intOrNull, ok, sarToHalalas, str, type ActionState } from "@/lib/admin-utils";

const schema = z.object({
  name: z.string().min(1, "اسم طريقة الشحن مطلوب").max(120, "الاسم طويل جدًا"),
  description: z.string().max(300, "الوصف طويل جدًا"),
});

export async function saveShippingAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = schema.safeParse({ name: str(fd, "name"), description: str(fd, "description") });
  if (!parsed.success) return fail(firstError(parsed.error));
  const price = sarToHalalas(str(fd, "price")) ?? 0;
  if (Number.isNaN(price)) return fail("سعر الشحن غير صالح");
  const freeAbove = sarToHalalas(str(fd, "freeAbove"));
  if (Number.isNaN(freeAbove)) return fail("حد الشحن المجاني غير صالح");
  const position = intOrNull(str(fd, "position")) ?? 0;
  if (Number.isNaN(position)) return fail("الترتيب يجب أن يكون رقمًا صحيحًا");

  const rawId = str(fd, "id");
  const id = rawId ? Number(rawId) : null;
  if (id !== null && (!Number.isInteger(id) || id <= 0)) return fail("طريقة شحن غير صالحة");

  const values = {
    name: parsed.data.name,
    description: parsed.data.description || null,
    price,
    freeAbove: freeAbove && freeAbove > 0 ? freeAbove : null,
    position,
    isActive: bool(fd, "isActive"),
  };
  if (id) {
    const res = await db.update(shippingMethods).set(values).where(eq(shippingMethods.id, id)).returning({ id: shippingMethods.id });
    if (!res.length) return fail("طريقة الشحن غير موجودة");
  } else {
    await db.insert(shippingMethods).values(values);
  }
  revalidatePath("/admin/shipping");
  return ok(id ? "تم حفظ طريقة الشحن" : "تمت إضافة طريقة الشحن");
}

export async function deleteShippingAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = z.coerce.number().int().positive().safeParse(fd.get("id"));
  if (!parsed.success) return fail("طريقة شحن غير صالحة");
  await db.delete(shippingMethods).where(eq(shippingMethods.id, parsed.data));
  revalidatePath("/admin/shipping");
  return ok("تم حذف طريقة الشحن");
}
