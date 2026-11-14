import { asc, eq, sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import { categories, productCategories } from "@/db/schema";
import { Badge, Card, Checkbox, EmptyState, Field, Input, PageHeader, Textarea } from "@/components/admin/ui";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/admin/client";
import { deleteCategoryAction, saveCategoryAction } from "./actions";

export const metadata = { title: "التصنيفات" };

export default async function AdminCategoriesPage() {
  const rows = await db
    .select({
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      description: categories.description,
      position: categories.position,
      isActive: categories.isActive,
      count: dsql<number>`count(${productCategories.productId})::int`,
    })
    .from(categories)
    .leftJoin(productCategories, eq(productCategories.categoryId, categories.id))
    .groupBy(categories.id)
    .orderBy(asc(categories.position), asc(categories.id));

  return (
    <>
      <PageHeader title="التصنيفات" subtitle={`${rows.length} تصنيف — التصنيفات الفارغة لا تظهر في قوائم المتجر`} />

      <Card title="إضافة تصنيف" className="mb-6">
        <ActionForm action={saveCategoryAction} resetOnSuccess>
          <div className="grid gap-4 md:grid-cols-4">
            <Field label="الاسم">
              <Input name="name" required maxLength={120} />
            </Field>
            <Field label="الرابط (slug)" hint="يُولَّد من الاسم إذا تُرك فارغًا">
              <Input name="slug" maxLength={160} />
            </Field>
            <Field label="الترتيب">
              <Input name="position" dir="ltr" inputMode="numeric" defaultValue={rows.length} />
            </Field>
            <div className="flex items-end pb-2.5">
              <Checkbox name="isActive" defaultChecked label="مفعّل" />
            </div>
            <Field label="الوصف (اختياري)" className="md:col-span-4">
              <Textarea name="description" rows={2} maxLength={1000} />
            </Field>
          </div>
          <div className="mt-4">
            <SubmitButton>إضافة التصنيف</SubmitButton>
          </div>
        </ActionForm>
      </Card>

      <Card title="كل التصنيفات" padded={false}>
        {rows.length ? (
          <ul className="divide-y divide-line/70">
            {rows.map((c) => (
              <li key={c.id}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-3.5 hover:bg-paper-card">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="w-6 text-center text-xs text-ink-mute">{c.position}</span>
                      <span className="truncate font-semibold">{c.name}</span>
                      <span className="hidden truncate font-mono text-[11px] text-ink-mute sm:block">/c/{c.slug}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge>{c.count} منتج</Badge>
                      <Badge tone={c.isActive ? "green" : "neutral"}>{c.isActive ? "مفعّل" : "مخفي"}</Badge>
                      <span className="text-xs font-semibold text-ink-mute group-open:hidden">تعديل</span>
                    </span>
                  </summary>
                  <div className="border-t border-line/70 bg-paper-card px-5 py-4">
                    <ActionForm action={saveCategoryAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <div className="grid gap-4 md:grid-cols-4">
                        <Field label="الاسم">
                          <Input name="name" defaultValue={c.name} required maxLength={120} />
                        </Field>
                        <Field label="الرابط (slug)" hint="تغييره يغيّر رابط صفحة التصنيف">
                          <Input name="slug" defaultValue={c.slug} maxLength={160} />
                        </Field>
                        <Field label="الترتيب">
                          <Input name="position" dir="ltr" inputMode="numeric" defaultValue={c.position} />
                        </Field>
                        <div className="flex items-end pb-2.5">
                          <Checkbox name="isActive" defaultChecked={c.isActive} label="مفعّل" />
                        </div>
                        <Field label="الوصف" className="md:col-span-4">
                          <Textarea name="description" rows={2} defaultValue={c.description ?? ""} maxLength={1000} />
                        </Field>
                      </div>
                      <div className="mt-4">
                        <SubmitButton variant="dark" size="sm">
                          حفظ
                        </SubmitButton>
                      </div>
                    </ActionForm>
                    <ActionForm action={deleteCategoryAction} className="mt-3 border-t border-line pt-3">
                      <input type="hidden" name="id" value={c.id} />
                      <ConfirmButton message={`حذف تصنيف «${c.name}»؟ المنتجات نفسها لن تُحذف.`}>حذف التصنيف</ConfirmButton>
                    </ActionForm>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>لا توجد تصنيفات.</EmptyState>
        )}
      </Card>
    </>
  );
}
