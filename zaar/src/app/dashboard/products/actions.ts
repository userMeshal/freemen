"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { categories, products, type Store } from "@/db/schema";
import type { ActionState } from "@/components/dash/client";
import { aiEnabled, writeProductDescription } from "@/lib/ai/claude";
import { merchantStore } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { ICONS } from "@/lib/themes";
import type { ProductOption } from "@/lib/types";
import { NO_SESSION, done, fail, idOf, isStoreImageUrl, text, zIntOptional, zSar, zSarOptional, zodFail } from "../_lib/form";

const MAX_IMAGES = 6;
const MAX_CATEGORIES = 40;

function refresh(store: Store) {
  revalidatePath("/dashboard/products");
  revalidatePath(`/s/${store.slug}`, "layout");
}

// ───────────────────────── المنتجات ─────────────────────────

export async function toggleProduct(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await merchantStore();
  if (!ctx) return NO_SESSION;
  const id = idOf(form);
  if (!id) return fail("منتج غير معروف");
  const rows = await db
    .update(products)
    .set({ status: sql`case when ${products.status} = 'active' then 'hidden' else 'active' end` })
    .where(and(eq(products.id, id), eq(products.storeId, ctx.store.id)))
    .returning({ status: products.status });
  if (!rows.length) return fail("منتج غير معروف");
  refresh(ctx.store);
  return done(rows[0].status === "active" ? "المنتج ظاهر في المتجر" : "تم إخفاء المنتج");
}

export async function deleteProduct(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await merchantStore();
  if (!ctx) return NO_SESSION;
  const id = idOf(form);
  if (!id) return fail("منتج غير معروف");
  const rows = await db
    .delete(products)
    .where(and(eq(products.id, id), eq(products.storeId, ctx.store.id)))
    .returning({ id: products.id });
  if (!rows.length) return fail("منتج غير معروف");
  refresh(ctx.store);
  return done("تم حذف المنتج");
}

const ProductInput = z.object({
  name: z.string().min(2, "اكتب اسم المنتج (حرفين على الأقل)"),
  description: z.string(),
  price: zSar("السعر", 100),
  compareAtPrice: zSarOptional("السعر قبل الخصم"),
  stock: zIntOptional("المخزون", 0, 100000),
  categoryId: zIntOptional("التصنيف", 1, 999999999),
  status: z.enum(["active", "hidden"], "اختر حالة المنتج"),
  hue: z.coerce.number().int().min(0).max(360),
  icon: z.enum(ICONS, "اختر أيقونة من القائمة"),
});

function readOption(form: FormData): { option: ProductOption | null; error?: string } {
  const name = text(form, "optionName", 30);
  const values = [
    ...new Set(
      form
        .getAll("optionValues")
        .flatMap((v) => (typeof v === "string" ? v.split(/[,،\n]/) : []))
        .map((v) => v.trim().slice(0, 30))
        .filter(Boolean),
    ),
  ];
  if (!name && !values.length) return { option: null };
  if (!name) return { option: null, error: "اكتب اسم الخيار (مثل: المقاس) أو احذف قيمه" };
  if (values.length < 2 || values.length > 8) return { option: null, error: "الخيار يحتاج من قيمتين إلى 8 قيم" };
  return { option: { name, values } };
}

export async function saveProduct(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await merchantStore();
  if (!ctx) return NO_SESSION;
  const { store } = ctx;

  const parsed = ProductInput.safeParse({
    name: text(form, "name", 80),
    description: text(form, "description", 2000),
    price: text(form, "price", 20),
    compareAtPrice: text(form, "compareAtPrice", 20),
    stock: text(form, "stock", 12),
    categoryId: text(form, "categoryId", 12),
    status: text(form, "status", 10),
    hue: text(form, "hue", 4),
    icon: text(form, "icon", 30),
  });
  if (!parsed.success) return zodFail(parsed.error);
  const input = parsed.data;
  if (input.compareAtPrice !== null && input.compareAtPrice <= input.price) return fail("السعر قبل الخصم لازم يكون أعلى من سعر البيع، أو اتركه فاضي");

  const { option, error: optionError } = readOption(form);
  if (optionError) return fail(optionError);

  const id = idOf(form);
  let saved: string[] = [];
  if (id) {
    const [current] = await db
      .select({ images: products.images })
      .from(products)
      .where(and(eq(products.id, id), eq(products.storeId, store.id)))
      .limit(1);
    if (!current) return fail("منتج غير معروف");
    saved = current.images;
  }
  // الروابط الجديدة لازم تكون من رفعنا نحن؛ الصور المحفوظة سابقًا على المنتج نفسه تبقى كما هي
  const images = [...new Set(form.getAll("images").filter((v): v is string => typeof v === "string" && v.length > 0))];
  if (images.length > MAX_IMAGES) return fail(`الحد الأقصى ${MAX_IMAGES} صور للمنتج`);
  if (images.some((u) => !saved.includes(u) && !isStoreImageUrl(u, store.id))) return fail("فيه صورة برابط غير مقبول — ارفع الصور من هنا فقط");

  if (input.categoryId !== null) {
    const hit = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, input.categoryId), eq(categories.storeId, store.id)))
      .limit(1);
    if (!hit.length) return fail("التصنيف المختار غير موجود");
  }

  const values = {
    name: input.name,
    description: input.description,
    price: input.price,
    compareAtPrice: input.compareAtPrice,
    stock: input.stock,
    categoryId: input.categoryId,
    status: input.status,
    isFeatured: form.get("isFeatured") === "on",
    art: { hue: input.hue, icon: input.icon },
    option,
    images,
  };

  if (id) {
    const rows = await db
      .update(products)
      .set(values)
      .where(and(eq(products.id, id), eq(products.storeId, store.id)))
      .returning({ id: products.id });
    if (!rows.length) return fail("منتج غير معروف");
    refresh(store);
    revalidatePath(`/dashboard/products/${id}`);
    return done("تم حفظ المنتج");
  }

  const existing = await db.select({ slug: products.slug, position: products.position }).from(products).where(eq(products.storeId, store.id));
  const taken = new Set(existing.map((r) => r.slug));
  const position = existing.reduce((m, r) => Math.max(m, r.position), -1) + 1;
  let n = existing.length + 1;
  let created = false;
  // السباق على نفس الـ slug نادر؛ نعيد المحاولة برقم تالٍ بدل الفشل
  for (let attempt = 0; attempt < 5 && !created; attempt++) {
    while (taken.has(`p-${n}`)) n++;
    const rows = await db
      .insert(products)
      .values({ ...values, storeId: store.id, slug: `p-${n}`, position })
      .onConflictDoNothing({ target: [products.storeId, products.slug] })
      .returning({ id: products.id });
    created = rows.length > 0;
    taken.add(`p-${n}`);
  }
  if (!created) return fail("تعذّر إنشاء المنتج — حاول مرة ثانية");
  refresh(store);
  redirect("/dashboard/products");
}

export async function describeProduct(input: { name: string; hints: string }): Promise<{ ok: boolean; text?: string; error?: string }> {
  const ctx = await merchantStore();
  if (!ctx) return { ok: false, error: "سجّل دخولك من جديد" };
  const name = String(input?.name ?? "").trim().slice(0, 80);
  const hints = String(input?.hints ?? "").trim().slice(0, 600);
  if (name.length < 2) return { ok: false, error: "اكتب اسم المنتج أول عشان نكتب له الوصف" };
  if (!aiEnabled()) return { ok: false, error: "الكتابة بالذكاء غير مفعّلة على المنصة حاليًا (مفتاح الذكاء الاصطناعي لم يُضبط بعد). اكتب الوصف يدويًا مؤقتًا." };
  if (!(await rateLimit(`ai-desc:${ctx.store.id}`, 30, 3600))) return { ok: false, error: "استخدمت الكتابة بالذكاء كثير هالساعة — جرّب بعد شوي" };
  try {
    const description = await writeProductDescription({ storeName: ctx.store.name, vertical: ctx.store.vertical, productName: name, hints });
    if (!description) return { ok: false, error: "ما قدرنا نكتب وصف هالمرة — جرّب مرة ثانية" };
    return { ok: true, text: description };
  } catch (e) {
    console.error("[products] ai description failed", e);
    const refused = e instanceof Error && e.message === "ai_refusal";
    return { ok: false, error: refused ? "ما قدرنا نكتب وصفًا لهذا المنتج — اكتبه يدويًا" : "خدمة الذكاء مشغولة الآن — جرّب بعد لحظات" };
  }
}

// ───────────────────────── التصنيفات ─────────────────────────

const CategoryInput = z.object({
  name: z.string().min(2, "اكتب اسم التصنيف (حرفين على الأقل)"),
  icon: z.enum(ICONS, "اختر أيقونة من القائمة"),
});

function readCategory(form: FormData) {
  return CategoryInput.safeParse({ name: text(form, "name", 40), icon: text(form, "icon", 30) || "Sparkles" });
}

export async function addCategory(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await merchantStore();
  if (!ctx) return NO_SESSION;
  const { store } = ctx;
  const parsed = readCategory(form);
  if (!parsed.success) return zodFail(parsed.error);

  const existing = await db.select({ slug: categories.slug, name: categories.name, position: categories.position }).from(categories).where(eq(categories.storeId, store.id));
  if (existing.length >= MAX_CATEGORIES) return fail(`الحد الأقصى ${MAX_CATEGORIES} تصنيفًا`);
  if (existing.some((c) => c.name === parsed.data.name)) return fail("عندك تصنيف بنفس الاسم");
  const taken = new Set(existing.map((c) => c.slug));
  const position = existing.reduce((m, c) => Math.max(m, c.position), -1) + 1;
  let n = existing.length + 1;
  let created = false;
  for (let attempt = 0; attempt < 5 && !created; attempt++) {
    while (taken.has(`c-${n}`)) n++;
    const rows = await db
      .insert(categories)
      .values({ storeId: store.id, slug: `c-${n}`, name: parsed.data.name, icon: parsed.data.icon, position })
      .onConflictDoNothing({ target: [categories.storeId, categories.slug] })
      .returning({ id: categories.id });
    created = rows.length > 0;
    taken.add(`c-${n}`);
  }
  if (!created) return fail("تعذّر إضافة التصنيف — حاول مرة ثانية");
  refresh(store);
  return done("تمت إضافة التصنيف");
}

export async function saveCategory(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await merchantStore();
  if (!ctx) return NO_SESSION;
  const id = idOf(form);
  if (!id) return fail("تصنيف غير معروف");
  const parsed = readCategory(form);
  if (!parsed.success) return zodFail(parsed.error);
  const rows = await db
    .update(categories)
    .set(parsed.data)
    .where(and(eq(categories.id, id), eq(categories.storeId, ctx.store.id)))
    .returning({ id: categories.id });
  if (!rows.length) return fail("تصنيف غير معروف");
  refresh(ctx.store);
  return done("تم الحفظ");
}

export async function deleteCategory(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await merchantStore();
  if (!ctx) return NO_SESSION;
  const id = idOf(form);
  if (!id) return fail("تصنيف غير معروف");
  const rows = await db
    .delete(categories)
    .where(and(eq(categories.id, id), eq(categories.storeId, ctx.store.id)))
    .returning({ id: categories.id });
  if (!rows.length) return fail("تصنيف غير معروف");
  refresh(ctx.store);
  return done("تم حذف التصنيف");
}
