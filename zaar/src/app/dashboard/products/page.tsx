import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { Eye, EyeOff, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { ActionButton } from "@/components/dash/client";
import { IconPicker } from "@/components/dash/merchant/IconPicker";
import { SafeForm, SafeSubmit } from "@/components/dash/merchant/SafeForm";
import { Badge, Card, Empty, Money, PageHead, TableWrap } from "@/components/dash/ui";
import { Art } from "@/components/ui/Art";
import { requireMerchantStore } from "@/lib/auth";
import { addCategory, deleteCategory, deleteProduct, saveCategory, toggleProduct } from "./actions";

export const metadata = { title: "المنتجات" };

export default async function ProductsPage() {
  const { store } = await requireMerchantStore();
  const [list, cats, catCounts] = await Promise.all([
    db.select().from(products).where(eq(products.storeId, store.id)).orderBy(asc(products.position), asc(products.id)),
    db.select().from(categories).where(eq(categories.storeId, store.id)).orderBy(asc(categories.position), asc(categories.id)),
    db
      .select({ categoryId: products.categoryId, n: sql<number>`count(*)::int` })
      .from(products)
      .where(eq(products.storeId, store.id))
      .groupBy(products.categoryId),
  ]);
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  const countOf = new Map(catCounts.map((c) => [c.categoryId, c.n]));
  const active = list.filter((p) => p.status === "active").length;

  return (
    <>
      <PageHead title="المنتجات" sub={list.length ? `${list.length} منتج، منها ${active} ظاهر في المتجر.` : "أضف منتجاتك وحدّد أسعارها ومخزونها."}>
        <Link href="/dashboard/products/new" className="dash-btn dash-btn-ink">
          <Plus size={16} /> منتج جديد
        </Link>
      </PageHead>

      {list.length === 0 ? (
        <Empty
          title="ما عندك منتجات للحين"
          text="أضف أول منتج وبيظهر في متجرك مباشرة. ما تحتاج صور عشان تبدأ — نرسم له لوحة ملوّنة تلقائيًا."
          action={
            <Link href="/dashboard/products/new" className="dash-btn dash-btn-accent">
              <Plus size={16} /> أضف أول منتج
            </Link>
          }
        />
      ) : (
        <TableWrap>
          <table className="dash-table">
            <thead>
              <tr>
                <th>المنتج</th>
                <th>التصنيف</th>
                <th>السعر</th>
                <th>المخزون</th>
                <th>المبيعات</th>
                <th>الحالة</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/dashboard/products/${p.id}`} className="flex min-w-52 items-center gap-3">
                      <span className="block h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-ink/5">
                        <Art image={p.images[0]} art={p.art} alt={p.name} />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 font-medium">
                          <span className="line-clamp-1">{p.name}</span>
                          {p.isFeatured && <Star size={13} className="shrink-0 fill-amber-400 text-amber-500" aria-label="مميّز" />}
                        </span>
                        {p.option && (
                          <span className="block text-xs text-ink/50">
                            {p.option.name}: <span className="num">{p.option.values.length}</span> قيم
                          </span>
                        )}
                      </span>
                    </Link>
                  </td>
                  <td className="whitespace-nowrap text-ink/65">{p.categoryId ? (catName.get(p.categoryId) ?? "—") : "—"}</td>
                  <td>
                    <Money value={p.price} />
                    {p.compareAtPrice !== null && p.compareAtPrice > p.price && (
                      <span className="block text-xs text-ink/45 line-through">
                        <Money value={p.compareAtPrice} />
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap">
                    {p.stock === null ? <span className="text-ink/60">غير محدود</span> : p.stock === 0 ? <Badge tone="bad">نفد</Badge> : <span className={`num font-semibold ${p.stock <= 3 ? "text-amber-700" : ""}`}>{p.stock}</span>}
                  </td>
                  <td className="num">{p.sold}</td>
                  <td>{p.status === "active" ? <Badge tone="good">ظاهر</Badge> : <Badge>مخفي</Badge>}</td>
                  <td>
                    <div className="flex items-center justify-end gap-1.5">
                      <ActionButton action={toggleProduct} fields={{ id: p.id }}>
                        {p.status === "active" ? <EyeOff size={14} /> : <Eye size={14} />}
                        {p.status === "active" ? "إخفاء" : "إظهار"}
                      </ActionButton>
                      <Link href={`/dashboard/products/${p.id}`} className="dash-btn dash-btn-ghost dash-btn-sm">
                        <Pencil size={14} /> تعديل
                      </Link>
                      <ActionButton
                        action={deleteProduct}
                        fields={{ id: p.id }}
                        className="dash-btn dash-btn-danger dash-btn-sm"
                        confirm={`تحذف «${p.name}» نهائيًا؟ تقييماته بتنحذف معه، والطلبات السابقة تبقى كما هي.`}
                      >
                        <Trash2 size={14} /> حذف
                      </ActionButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}

      <Card title="التصنيفات" className="mt-6">
        <p className="-mt-2 mb-4 text-xs leading-relaxed text-ink/55">التصنيفات ترتّب منتجاتك في المتجر. حذف التصنيف ما يحذف منتجاته، بس تصير بدون تصنيف.</p>
        {cats.length > 0 && (
          <ul className="mb-5 space-y-3">
            {cats.map((c) => (
              <li key={c.id} className="flex flex-wrap items-start gap-2 rounded-2xl bg-ink/[0.03] p-2.5">
                <SafeForm action={saveCategory} className="min-w-0 flex-1">
                  <input type="hidden" name="id" value={c.id} />
                  <div className="flex items-center gap-2">
                    <IconPicker defaultValue={c.icon} />
                    <input name="name" defaultValue={c.name} className="dash-input min-w-0 flex-1" required minLength={2} maxLength={40} aria-label="اسم التصنيف" />
                    <SafeSubmit className="dash-btn dash-btn-ghost dash-btn-sm">حفظ</SafeSubmit>
                  </div>
                </SafeForm>
                <div className="flex items-center gap-2 self-center">
                  <span className="whitespace-nowrap text-xs text-ink/50">
                    <span className="num">{countOf.get(c.id) ?? 0}</span> منتج
                  </span>
                  <ActionButton
                    action={deleteCategory}
                    fields={{ id: c.id }}
                    className="dash-btn dash-btn-danger dash-btn-sm"
                    confirm={`تحذف تصنيف «${c.name}»؟ منتجاته تبقى موجودة بدون تصنيف.`}
                  >
                    <Trash2 size={14} /> حذف
                  </ActionButton>
                </div>
              </li>
            ))}
          </ul>
        )}
        <SafeForm action={addCategory} className="max-w-xl">
          <span className="dash-label">تصنيف جديد</span>
          <div className="flex items-center gap-2">
            <IconPicker />
            <input name="name" className="dash-input min-w-0 flex-1" required minLength={2} maxLength={40} placeholder="مثال: عطور رجالية" aria-label="اسم التصنيف الجديد" />
            <SafeSubmit className="dash-btn dash-btn-ink">
              <Plus size={16} /> أضف
            </SafeSubmit>
          </div>
        </SafeForm>
      </Card>
    </>
  );
}
