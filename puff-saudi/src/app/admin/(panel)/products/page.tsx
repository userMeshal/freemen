/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { and, asc, eq, ilike, inArray, or, sql as dsql, type SQL } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db } from "@/db";
import { productImages, products, variants } from "@/db/schema";
import { formatSar } from "@/lib/money";
import { normalizeArabic } from "@/lib/normalize";
import { FAMILY_OPTIONS, familyLabel, one, pageNumber } from "@/lib/admin-utils";
import { Badge, Card, EmptyState, Input, LinkButton, PageHeader, Pagination, Select, Table, Td, Th, btnCls } from "@/components/admin/ui";
import { ActionForm, SelectAll, SubmitButton } from "@/components/admin/client";
import { bulkStockAction } from "./actions";

export const metadata = { title: "المنتجات" };

const PER_PAGE = 25;

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = one(sp.q);
  const family = one(sp.family);
  const status = one(sp.status);
  const page = pageNumber(sp.page);
  const deleted = one(sp.deleted) === "1";

  const conds: SQL[] = [];
  if (q) {
    const terms = normalizeArabic(q).split(" ").filter(Boolean).slice(0, 6);
    const raw = `%${q.replace(/[%_]/g, "")}%`;
    const byText = terms.length ? and(...terms.map((t) => ilike(products.searchText, `%${t}%`))) : undefined;
    conds.push(or(...(byText ? [byText] : []), ilike(products.slug, raw), ilike(products.name, raw))!);
  }
  if (FAMILY_OPTIONS.some((f) => f.value === family)) conds.push(eq(products.family, family));
  if (status === "active" || status === "draft") conds.push(eq(products.status, status));
  const where = conds.length ? and(...conds) : undefined;

  const [rows, total] = await Promise.all([
    db
      .select()
      .from(products)
      .where(where)
      .orderBy(asc(products.position), asc(products.id))
      .limit(PER_PAGE)
      .offset((page - 1) * PER_PAGE),
    db.select({ c: dsql<number>`count(*)::int` }).from(products).where(where),
  ]);
  const count = total[0]?.c ?? 0;
  const ids = rows.map((r) => r.id);

  const [imgs, vstats] = ids.length
    ? await Promise.all([
        db
          .select({ productId: productImages.productId, url: productImages.url, bg: productImages.bg })
          .from(productImages)
          .where(inArray(productImages.productId, ids))
          .orderBy(asc(productImages.position), asc(productImages.id)),
        db
          .select({
            productId: variants.productId,
            count: dsql<number>`count(*)::int`,
            unlimited: dsql<number>`count(*) filter (where ${variants.stock} is null)::int`,
            stock: dsql<number>`coalesce(sum(${variants.stock}), 0)::int`,
          })
          .from(variants)
          .where(inArray(variants.productId, ids))
          .groupBy(variants.productId),
      ])
    : [[], []];
  const thumb = new Map<number, { url: string; bg: string }>();
  for (const i of imgs) if (!thumb.has(i.productId)) thumb.set(i.productId, i);
  const stats = new Map(vstats.map((v) => [v.productId, v]));

  return (
    <>
      <PageHeader title="المنتجات" subtitle={`${count.toLocaleString("en-US")} منتج`}>
        <LinkButton href="/admin/products/new" variant="primary">
          <Plus className="h-4 w-4" /> منتج جديد
        </LinkButton>
      </PageHeader>

      {deleted ? <p className="mb-4 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-800">تم حذف المنتج.</p> : null}

      <Card className="mb-4">
        <form method="get" className="grid gap-3 md:grid-cols-[1fr_200px_160px_auto]">
          <Input name="q" defaultValue={q} placeholder="بحث بالاسم، اللون، SKU أو الرابط" aria-label="بحث" />
          <Select name="family" defaultValue={family} aria-label="العائلة">
            <option value="">كل العائلات</option>
            {FAMILY_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
          <Select name="status" defaultValue={status} aria-label="الحالة">
            <option value="">كل الحالات</option>
            <option value="active">منشور</option>
            <option value="draft">مسودة</option>
          </Select>
          <div className="flex gap-2">
            <button type="submit" className={btnCls("dark")}>
              تصفية
            </button>
            {q || family || status ? <LinkButton href="/admin/products">مسح</LinkButton> : null}
          </div>
        </form>
      </Card>

      <Card padded={false}>
        {rows.length ? (
          <ActionForm action={bulkStockAction} flashClassName="mx-5 mb-4">
            <Table>
              <thead>
                <tr>
                  <Th className="w-10">
                    <SelectAll name="ids" />
                  </Th>
                  <Th>المنتج</Th>
                  <Th>العائلة</Th>
                  <Th>السعر</Th>
                  <Th>المتغيرات</Th>
                  <Th>المخزون</Th>
                  <Th>الحالة</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const t = thumb.get(p.id);
                  const s = stats.get(p.id);
                  const stockLabel = !s
                    ? "—"
                    : s.unlimited === s.count
                      ? "غير محدود"
                      : s.unlimited > 0
                        ? `${s.stock} + غير محدود`
                        : String(s.stock);
                  return (
                    <tr key={p.id} className="hover:bg-paper-card">
                      <Td>
                        <input type="checkbox" name="ids" value={p.id} aria-label={`تحديد ${p.name}`} className="h-4 w-4 rounded border-line accent-ink" />
                      </Td>
                      <Td>
                        <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3">
                          <span className="block h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-line" style={{ background: t?.bg ?? "#EBE5D6" }}>
                            {t ? <img src={t.url} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
                          </span>
                          <span className="min-w-0">
                            <span className="block max-w-[320px] truncate font-semibold hover:underline">{p.name}</span>
                            <span className="block truncate font-mono text-[11px] text-ink-mute" dir="ltr" style={{ textAlign: "right" }}>
                              /p/{p.slug}
                            </span>
                          </span>
                        </Link>
                      </Td>
                      <Td className="whitespace-nowrap text-ink-mute">{familyLabel(p.family)}</Td>
                      <Td className="whitespace-nowrap">
                        <span className="font-semibold">{formatSar(p.price)}</span>
                        {p.compareAtPrice ? <s className="ms-2 text-xs text-ink-mute">{formatSar(p.compareAtPrice)}</s> : null}
                      </Td>
                      <Td>{s?.count ?? 0}</Td>
                      <Td className="whitespace-nowrap">
                        {s && s.unlimited !== s.count && s.stock <= 5 && s.unlimited === 0 ? <Badge tone="amber">{stockLabel}</Badge> : stockLabel}
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge tone={p.status === "active" ? "green" : "neutral"}>{p.status === "active" ? "منشور" : "مسودة"}</Badge>
                          {p.isBestSeller ? <Badge tone="lime">الأكثر مبيعًا</Badge> : null}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <div className="flex flex-wrap items-end gap-3 border-t border-line bg-paper-card px-5 py-4">
              <span className="text-xs font-semibold text-ink-mute">مخزون المنتجات المحددة:</span>
              {/* زر «تعيين الكمية» أولًا في ترتيب DOM ليكون هو الافتراضي عند ضغط Enter داخل حقل الكمية */}
              <div className="flex items-stretch gap-2">
                <Input name="stock" dir="ltr" inputMode="numeric" placeholder="الكمية" aria-label="كمية المخزون" className="!w-28 !py-1.5" />
                <SubmitButton variant="dark" size="sm" name="op" value="set">
                  تعيين الكمية
                </SubmitButton>
              </div>
              <SubmitButton variant="outline" size="sm" name="op" value="unlimited">
                اجعل المخزون غير محدود
              </SubmitButton>
            </div>
          </ActionForm>
        ) : (
          <EmptyState>{q || family || status ? "لا توجد منتجات مطابقة." : "لا توجد منتجات بعد."}</EmptyState>
        )}
        <Pagination page={page} totalPages={Math.ceil(count / PER_PAGE)} basePath="/admin/products" params={{ q, family, status }} />
      </Card>
    </>
  );
}
