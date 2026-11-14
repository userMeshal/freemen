import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

/**
 * بيانات تجريبية: حساب تاجر ومتجران منشوران (ثيم جريء وثيم ناعم) لمعاينة المنصة فورًا.
 *   npm run db:seed
 * الجوال: 0500000001 — كلمة المرور: zaar-demo-2026
 */
async function main() {
  const { eq } = await import("drizzle-orm");
  const { db, sql } = await import("../src/db");
  const { merchants, stores } = await import("../src/db/schema");
  const { localBlueprint } = await import("../src/lib/ai/local");
  const { hashPassword } = await import("../src/lib/password");
  const { createStoreFromBlueprint } = await import("../src/lib/store-write");

  const demos = [
    { phone: "0500000001", name: "تاجر تجريبي", slug: "demo-street", idea: "متجر ملابس ستريت وير شبابي اسمه هبّة" },
    { phone: "0500000002", name: "تاجرة تجريبية", slug: "demo-oud", idea: "متجر عطور وبخور فاخر اسمه عبق" },
  ];
  for (const d of demos) {
    const existing = await db.select({ id: stores.id }).from(stores).where(eq(stores.slug, d.slug)).limit(1);
    if (existing.length) {
      console.log(`• ${d.slug} موجود مسبقًا`);
      continue;
    }
    const [merchant] = await db
      .insert(merchants)
      .values({ name: d.name, phone: d.phone, passwordHash: await hashPassword("zaar-demo-2026") })
      .onConflictDoUpdate({ target: merchants.phone, set: { name: d.name } })
      .returning();
    const blueprint = { ...localBlueprint(d.idea), slug: d.slug };
    const { store } = await createStoreFromBlueprint(blueprint, d.idea, merchant.id);
    console.log(`✓ ${store.name} → /s/${store.slug} (${store.theme})`);
  }
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
