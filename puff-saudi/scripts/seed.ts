/**
 * يبذر قاعدة البيانات من data/catalog.json (المنقول من المتجر الأصلي puffsaudi.cc).
 * آمن للتكرار: لا يكرر البيانات الموجودة. استخدم --force لإعادة استيراد الكتالوج (يحذف المنتجات الحالية).
 */
import { loadEnvConfig } from "@next/env";
import { readFileSync } from "node:fs";
import { randomBytes, scryptSync } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql as dsql } from "drizzle-orm";
import * as schema from "../src/db/schema";

loadEnvConfig(process.cwd());

type Img = {
  file: string;
  bg: string;
  accent: string;
  cutout: { file: string; w: number; h: number } | null;
};
type Catalog = {
  store: { email: string; crNumber: string; vatNumber: string };
  categories: { name: string; slug: string; position: number }[];
  bestSellers: string[];
  pages: { slug: string; title: string; bodyHtml: string }[];
  products: {
    slug: string;
    legacySlug: string;
    name: string;
    family: string;
    capacityMl: number | null;
    colorName: string | null;
    descriptionHtml: string;
    metaDescription: string;
    price: number;
    compareAtPrice: number | null;
    categories: string[];
    createdAt: string;
    images: Img[];
    optionName: string | null;
    position: number;
    variants: { sku: string; optionValue: string | null; price: number; compareAtPrice: number | null; image: Img | null }[];
  }[];
};

function normalizeArabic(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[ىئ]/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${scryptSync(password, salt, 64).toString("hex")}`;
}

const FAMILY_WORDS: Record<string, string> = {
  sippy: "sippy سيبي",
  coffee: "coffee كوفي قهوه",
  "flippy-steel": "flippy فليبي ستانلس steel اطفال",
  "flippy-tritan": "flippy فليبي تريتان tritan اطفال",
  special: "special اصدار خاص",
  accessories: "ماصات اكسسوارات straws",
};

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL غير مضبوط");
  const force = process.argv.includes("--force");
  const isLocal = /localhost|127\.0\.0\.1/.test(url);
  const sql = postgres(url, { max: 1, ssl: isLocal ? false : "require", onnotice: () => {} });
  const db = drizzle(sql, { schema });
  const catalog = JSON.parse(readFileSync("./data/catalog.json", "utf8")) as Catalog;

  // ───── الإعدادات ─────
  const existingSettings = await db.select().from(schema.settings).where(eq(schema.settings.key, "store"));
  if (!existingSettings.length) {
    await db.insert(schema.settings).values({
      key: "store",
      value: {
        storeName: "PUFF SAUDI",
        email: catalog.store.email,
        crNumber: catalog.store.crNumber,
        vatNumber: catalog.store.vatNumber,
        vatRate: 15,
        edfapayEnabled: true,
        codEnabled: false,
        codFee: 0,
      },
    });
    console.log("✓ إعدادات المتجر");
  }

  // ───── الصفحات ─────
  for (const p of catalog.pages) {
    const slug = p.slug === "terms-of-service" ? "terms" : p.slug;
    await db.insert(schema.pages).values({ slug, title: p.title, bodyHtml: p.bodyHtml }).onConflictDoNothing();
  }
  console.log(`✓ الصفحات (${catalog.pages.length})`);

  // ───── الشحن ─────
  const ship = await db.select({ id: schema.shippingMethods.id }).from(schema.shippingMethods).limit(1);
  if (!ship.length) {
    await db.insert(schema.shippingMethods).values({
      name: "التوصيل القياسي داخل المملكة",
      description: "من 3 إلى 5 أيام عمل بعد تجهيز الطلب",
      price: 2500,
      freeAbove: null,
      position: 0,
    });
    console.log("✓ طريقة الشحن الافتراضية (عدّل السعر من لوحة التحكم ← الشحن)");
  }

  // ───── المدير ─────
  const adminCount = await db.select({ id: schema.admins.id }).from(schema.admins).limit(1);
  if (!adminCount.length) {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    if (email && password && password.length >= 10) {
      await db.insert(schema.admins).values({ email, name: "مدير المتجر", passwordHash: hashPassword(password) });
      console.log(`✓ حساب المدير: ${email}`);
    } else {
      console.warn("! لم يُنشأ حساب مدير: اضبط ADMIN_EMAIL و ADMIN_PASSWORD (10 أحرف على الأقل) ثم أعد تشغيل db:seed");
    }
  }

  // ───── الكتالوج ─────
  const have = await db.select({ c: dsql<number>`count(*)::int` }).from(schema.products);
  if (have[0].c > 0 && !force) {
    console.log(`• الكتالوج موجود مسبقًا (${have[0].c} منتج) — تم التخطي. استخدم --force لإعادة الاستيراد.`);
    await sql.end();
    return;
  }
  if (force) {
    await db.delete(schema.products);
    await db.delete(schema.categories);
  }

  await db.transaction(async (tx) => {
    const catIds = new Map<string, number>();
    for (const c of catalog.categories) {
      const r = await tx
        .insert(schema.categories)
        .values({ slug: c.slug, name: c.name, position: c.position })
        .returning({ id: schema.categories.id });
      catIds.set(c.slug, r[0].id);
    }

    let variantsTotal = 0;
    let imagesTotal = 0;
    for (const p of catalog.products) {
      const searchText = normalizeArabic(
        [
          p.name,
          p.colorName ?? "",
          p.capacityMl ? `${p.capacityMl} مل ml` : "",
          FAMILY_WORDS[p.family] ?? "",
          p.variants.map((v) => v.optionValue ?? "").join(" "),
          p.variants.map((v) => v.sku).join(" "),
        ].join(" "),
      );
      const created = await tx
        .insert(schema.products)
        .values({
          slug: p.slug,
          legacySlug: p.legacySlug,
          name: p.name,
          family: p.family,
          capacityMl: p.capacityMl,
          colorName: p.colorName,
          descriptionHtml: p.descriptionHtml,
          metaDescription: p.metaDescription || null,
          optionName: p.optionName,
          price: p.price,
          compareAtPrice: p.compareAtPrice,
          isBestSeller: catalog.bestSellers.includes(p.slug),
          position: p.position,
          searchText,
          createdAt: new Date(p.createdAt.replace(" ", "T") + "Z"),
        })
        .returning({ id: schema.products.id });
      const productId = created[0].id;

      const imageIds = new Map<string, number>();
      let pos = 0;
      for (const img of p.images) {
        if (imageIds.has(img.file)) continue;
        const r = await tx
          .insert(schema.productImages)
          .values({
            productId,
            url: `/media/products/${img.file}`,
            bg: img.bg,
            accent: img.accent,
            cutoutUrl: img.cutout ? `/media/cutouts/${img.cutout.file}` : null,
            cutoutW: img.cutout?.w ?? null,
            cutoutH: img.cutout?.h ?? null,
            position: pos++,
          })
          .returning({ id: schema.productImages.id });
        imageIds.set(img.file, r[0].id);
        imagesTotal++;
      }

      await tx.insert(schema.variants).values(
        p.variants.map((v, i) => ({
          productId,
          sku: v.sku,
          optionValue: v.optionValue,
          price: v.price,
          compareAtPrice: v.compareAtPrice,
          stock: null, // مخزون غير محدود — يُعدَّل من لوحة التحكم
          imageId: v.image ? (imageIds.get(v.image.file) ?? null) : null,
          position: i,
        })),
      );
      variantsTotal += p.variants.length;

      const cats = [...new Set(p.categories)].map((s) => catIds.get(s)).filter((x): x is number => Boolean(x));
      if (cats.length) {
        await tx.insert(schema.productCategories).values(cats.map((categoryId) => ({ productId, categoryId })));
      }
    }
    console.log(
      `✓ الكتالوج: ${catalog.products.length} منتج، ${variantsTotal} متغير، ${imagesTotal} صورة، ${catalog.categories.length} تصنيف`,
    );
  });

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
