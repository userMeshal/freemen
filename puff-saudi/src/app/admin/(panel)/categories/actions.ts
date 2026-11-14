"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { slugify } from "@/lib/normalize";
import { bool, fail, firstError, intOrNull, ok, str, type ActionState } from "@/lib/admin-utils";

const schema = z.object({
  name: z.string().min(1, "اسم التصنيف مطلوب").max(120, "الاسم طويل جدًا"),
  slug: z.string().max(160),
  description: z.string().max(1000, "الوصف طويل جدًا"),
});

function refresh() {
  revalidateTag("catalog");
  revalidatePath("/admin/categories");
}

export async function saveCategoryAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = schema.safeParse({ name: str(fd, "name"), slug: str(fd, "slug"), description: str(fd, "description") });
  if (!parsed.success) return fail(firstError(parsed.error));
  const position = intOrNull(str(fd, "position")) ?? 0;
  if (Number.isNaN(position)) return fail("الترتيب يجب أن يكون رقمًا صحيحًا");
  const slug = slugify(parsed.data.slug || parsed.data.name);
  if (!slug) return fail("تعذر توليد الرابط (slug)");

  const rawId = str(fd, "id");
  const id = rawId ? Number(rawId) : null;
  if (id !== null && (!Number.isInteger(id) || id <= 0)) return fail("تصنيف غير صالح");

  const clash = await db
    .select({ id: categories.id })
    .from(categories)
    .where(id ? and(eq(categories.slug, slug), ne(categories.id, id)) : eq(categories.slug, slug))
    .limit(1);
  if (clash.length) return fail("الرابط (slug) مستخدم لتصنيف آخر");

  const values = {
    name: parsed.data.name,
    slug,
    description: parsed.data.description || null,
    position,
    isActive: bool(fd, "isActive"),
  };
  if (id) {
    const res = await db.update(categories).set(values).where(eq(categories.id, id)).returning({ id: categories.id });
    if (!res.length) return fail("التصنيف غير موجود");
    refresh();
    return ok("تم حفظ التصنيف");
  }
  await db.insert(categories).values(values);
  refresh();
  return ok("تمت إضافة التصنيف");
}

export async function deleteCategoryAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = z.coerce.number().int().positive().safeParse(fd.get("id"));
  if (!parsed.success) return fail("تصنيف غير صالح");
  await db.delete(categories).where(eq(categories.id, parsed.data));
  refresh();
  return ok("تم حذف التصنيف");
}
