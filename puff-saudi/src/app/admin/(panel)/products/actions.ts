"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, ne, notInArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { categories, productCategories, productImages, products, variants } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { sanitizeHtml, slugify } from "@/lib/normalize";
import {
  buildSearchText,
  fail,
  firstError,
  HEX_RE,
  intOrNull,
  isAllowedImageUrl,
  ok,
  sarToHalalas,
  str,
  type ActionState,
} from "@/lib/admin-utils";

const FAMILIES = ["sippy", "coffee", "flippy-steel", "flippy-tritan", "special", "accessories", "other"] as const;

const imageSchema = z.object({
  id: z.number().int().positive().optional(),
  key: z.string().min(1).max(60),
  url: z.string().trim().max(600).refine(isAllowedImageUrl, "رابط صورة غير مسموح: ارفع الصورة من الزر أو استخدم رابط Vercel Blob"),
  bg: z.string().regex(HEX_RE, "لون الخلفية يجب أن يكون بصيغة ‎#RRGGBB"),
  accent: z.string().regex(HEX_RE, "لون المنتج يجب أن يكون بصيغة ‎#RRGGBB"),
});

const variantSchema = z.object({
  id: z.number().int().positive().optional(),
  sku: z.string().trim().min(1, "رمز SKU مطلوب لكل متغير").max(80),
  optionValue: z.string().trim().max(120),
  price: z.string(),
  compareAt: z.string(),
  stock: z.string(),
  isActive: z.boolean(),
  imageKey: z.string().max(60).nullable(),
});

const productSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(2, "اسم المنتج مطلوب").max(200),
  slug: z.string().trim().max(200),
  family: z.enum(FAMILIES),
  capacityMl: z.string(),
  colorName: z.string().trim().max(120),
  optionName: z.string().trim().max(80),
  descriptionHtml: z.string().max(30000),
  metaDescription: z.string().trim().max(400),
  status: z.enum(["active", "draft"]),
  isBestSeller: z.boolean(),
  position: z.string(),
  categoryIds: z.array(z.number().int().positive()).max(100),
  images: z.array(imageSchema).max(60),
  variants: z.array(variantSchema).min(1, "يجب أن يحتوي المنتج على متغير واحد على الأقل").max(120),
});

export async function saveProductAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  let json: unknown;
  try {
    json = JSON.parse(String(fd.get("payload") ?? ""));
  } catch {
    return fail("تعذر قراءة بيانات النموذج");
  }
  const parsed = productSchema.safeParse(json);
  if (!parsed.success) return fail(firstError(parsed.error));
  const data = parsed.data;

  const capacityMl = intOrNull(data.capacityMl);
  if (Number.isNaN(capacityMl)) return fail("السعة يجب أن تكون رقمًا صحيحًا (مل)");
  const position = intOrNull(data.position) ?? 999;
  if (Number.isNaN(position)) return fail("الترتيب يجب أن يكون رقمًا صحيحًا");

  const slug = slugify(data.slug || data.name);
  if (!slug) return fail("تعذر توليد رابط (slug) للمنتج — اكتبه يدويًا");

  // التحقق من المتغيرات
  const vrows: {
    id?: number;
    sku: string;
    optionValue: string | null;
    price: number;
    compareAtPrice: number | null;
    stock: number | null;
    isActive: boolean;
    imageKey: string | null;
  }[] = [];
  const seenSku = new Set<string>();
  for (const [i, v] of data.variants.entries()) {
    const n = i + 1;
    const price = sarToHalalas(v.price);
    if (price === null || Number.isNaN(price) || price <= 0) return fail(`المتغير ${n}: السعر مطلوب ويجب أن يكون رقمًا أكبر من صفر`);
    const compare = sarToHalalas(v.compareAt);
    if (Number.isNaN(compare)) return fail(`المتغير ${n}: السعر قبل الخصم غير صالح`);
    if (compare !== null && compare <= price) return fail(`المتغير ${n}: السعر قبل الخصم يجب أن يكون أعلى من السعر الحالي (أو اتركه فارغًا)`);
    const stock = intOrNull(v.stock);
    if (Number.isNaN(stock)) return fail(`المتغير ${n}: المخزون يجب أن يكون رقمًا صحيحًا أو يُترك فارغًا (غير محدود)`);
    if (seenSku.has(v.sku)) return fail(`رمز SKU مكرر داخل المنتج: ${v.sku}`);
    seenSku.add(v.sku);
    if (data.variants.length > 1 && !v.optionValue) return fail(`المتغير ${n}: اكتب قيمة الخيار (مثل اللون أو السعة)`);
    vrows.push({
      id: v.id,
      sku: v.sku,
      optionValue: v.optionValue || null,
      price,
      compareAtPrice: compare,
      stock,
      isActive: v.isActive,
      imageKey: v.imageKey,
    });
  }
  if (!vrows.some((v) => v.isActive)) return fail("يجب أن يكون متغير واحد على الأقل مفعّلًا");

  const clash = await db
    .select({ id: products.id })
    .from(products)
    .where(data.id ? and(eq(products.slug, slug), ne(products.id, data.id)) : eq(products.slug, slug))
    .limit(1);
  if (clash.length) return fail("الرابط (slug) مستخدم لمنتج آخر — اختر رابطًا مختلفًا");

  const priced = vrows.filter((v) => v.isActive);
  const price = Math.min(...priced.map((v) => v.price));
  const compares = priced.map((v) => v.compareAtPrice);
  const compareAtPrice = compares.every((c): c is number => c !== null) ? Math.max(...compares) : null;
  const optionName = data.variants.length > 1 ? data.optionName || "الخيار" : data.optionName || null;

  const values = {
    slug,
    name: data.name,
    family: data.family,
    capacityMl,
    colorName: data.colorName || null,
    descriptionHtml: sanitizeHtml(data.descriptionHtml),
    metaDescription: data.metaDescription || null,
    optionName,
    price,
    compareAtPrice: compareAtPrice !== null && compareAtPrice > price ? compareAtPrice : null,
    status: data.status,
    isBestSeller: data.isBestSeller,
    position,
    searchText: buildSearchText({
      name: data.name,
      colorName: data.colorName || null,
      capacityMl,
      family: data.family,
      variants: vrows,
    }),
    updatedAt: new Date(),
  };

  let productId: number;
  try {
    productId = await db.transaction(async (tx) => {
      let pid = data.id;
      if (pid) {
        const res = await tx.update(products).set(values).where(eq(products.id, pid)).returning({ id: products.id });
        if (!res.length) throw new Error("NOT_FOUND");
      } else {
        const res = await tx.insert(products).values(values).returning({ id: products.id });
        pid = res[0].id;
      }

      // الصور
      const keepImageIds = data.images.map((i) => i.id).filter((x): x is number => Boolean(x));
      const existingImages = await tx.select({ id: productImages.id }).from(productImages).where(eq(productImages.productId, pid));
      const ownImageIds = new Set(existingImages.map((i) => i.id));
      const removeImages = existingImages.map((i) => i.id).filter((id) => !keepImageIds.includes(id));
      if (removeImages.length) await tx.delete(productImages).where(inArray(productImages.id, removeImages));
      const keyToImageId = new Map<string, number>();
      for (const [pos, img] of data.images.entries()) {
        if (img.id && ownImageIds.has(img.id)) {
          await tx
            .update(productImages)
            .set({ bg: img.bg, accent: img.accent, position: pos })
            .where(and(eq(productImages.id, img.id), eq(productImages.productId, pid)));
          keyToImageId.set(img.key, img.id);
        } else {
          const res = await tx
            .insert(productImages)
            .values({ productId: pid, url: img.url, bg: img.bg, accent: img.accent, position: pos })
            .returning({ id: productImages.id });
          keyToImageId.set(img.key, res[0].id);
        }
      }

      // المتغيرات
      const existingVariants = await tx.select({ id: variants.id }).from(variants).where(eq(variants.productId, pid));
      const ownVariantIds = new Set(existingVariants.map((v) => v.id));
      const keepVariantIds = vrows.map((v) => v.id).filter((x): x is number => Boolean(x) && ownVariantIds.has(x as number));
      const removeVariants = existingVariants.map((v) => v.id).filter((id) => !keepVariantIds.includes(id));
      if (removeVariants.length) await tx.delete(variants).where(inArray(variants.id, removeVariants));
      for (const [pos, v] of vrows.entries()) {
        const row = {
          sku: v.sku,
          optionValue: v.optionValue,
          price: v.price,
          compareAtPrice: v.compareAtPrice,
          stock: v.stock,
          isActive: v.isActive,
          imageId: v.imageKey ? (keyToImageId.get(v.imageKey) ?? null) : null,
          position: pos,
        };
        if (v.id && ownVariantIds.has(v.id)) {
          await tx.update(variants).set(row).where(and(eq(variants.id, v.id), eq(variants.productId, pid)));
        } else {
          await tx.insert(variants).values({ ...row, productId: pid });
        }
      }

      // التصنيفات
      const validCats = data.categoryIds.length
        ? await tx.select({ id: categories.id }).from(categories).where(inArray(categories.id, data.categoryIds))
        : [];
      const catIds = validCats.map((c) => c.id);
      await tx
        .delete(productCategories)
        .where(
          catIds.length
            ? and(eq(productCategories.productId, pid), notInArray(productCategories.categoryId, catIds))
            : eq(productCategories.productId, pid),
        );
      if (catIds.length) {
        await tx
          .insert(productCategories)
          .values(catIds.map((categoryId) => ({ productId: pid!, categoryId })))
          .onConflictDoNothing();
      }
      return pid;
    });
  } catch (e) {
    if (e instanceof Error && e.message === "NOT_FOUND") return fail("المنتج غير موجود");
    console.error("saveProductAction", e);
    return fail("تعذر حفظ المنتج. حاول مرة أخرى.");
  }

  revalidateTag("catalog");
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}`);
  // إعادة تحميل النموذج ببيانات القاعدة (معرّفات الصور والمتغيرات الجديدة)
  redirect(`/admin/products/${productId}?saved=${Date.now()}`);
}

export async function deleteProductAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = z.coerce.number().int().positive().safeParse(fd.get("id"));
  if (!parsed.success) return fail("منتج غير صالح");
  const res = await db.delete(products).where(eq(products.id, parsed.data)).returning({ id: products.id });
  if (!res.length) return fail("المنتج غير موجود");
  revalidateTag("catalog");
  revalidatePath("/admin/products");
  redirect("/admin/products?deleted=1");
}

/** ضبط مخزون كل متغيرات منتج أو أكثر: op=unlimited أو op=set مع قيمة */
export async function bulkStockAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const ids = fd
    .getAll("ids")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n > 0);
  if (!ids.length) return fail("حدّد منتجًا واحدًا على الأقل");
  if (ids.length > 500) return fail("عدد المنتجات المحددة كبير جدًا");
  const op = str(fd, "op");
  let stock: number | null;
  if (op === "unlimited") stock = null;
  else if (op === "set") {
    const n = intOrNull(str(fd, "stock"));
    if (n === null || Number.isNaN(n) || n > 1_000_000) return fail("اكتب كمية مخزون صحيحة (رقم صحيح غير سالب)");
    stock = n;
  } else return fail("اختر الإجراء المطلوب");

  const res = await db.update(variants).set({ stock }).where(inArray(variants.productId, ids)).returning({ id: variants.id });
  revalidateTag("catalog");
  revalidatePath("/admin/products");
  revalidatePath("/admin");
  const single = str(fd, "redirectTo");
  if (single && /^\/admin\/products\/\d+$/.test(single)) {
    revalidatePath(single);
    redirect(`${single}?saved=${Date.now()}`);
  }
  return ok(
    stock === null
      ? `تم جعل المخزون غير محدود لـ ${res.length} متغير`
      : `تم ضبط المخزون على ${stock} لـ ${res.length} متغير`,
  );
}
