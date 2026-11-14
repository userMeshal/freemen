import { asc } from "drizzle-orm";
import { db } from "@/db";
import { shippingMethods } from "@/db/schema";
import { formatSar } from "@/lib/money";
import { halalasToInput } from "@/lib/admin-utils";
import { Badge, Card, Checkbox, EmptyState, Field, Input, PageHeader } from "@/components/admin/ui";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/admin/client";
import { deleteShippingAction, saveShippingAction } from "./actions";

export const metadata = { title: "الشحن" };

type Row = typeof shippingMethods.$inferSelect;

function Fields({ m, nextPosition }: { m?: Row; nextPosition?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-6">
      <Field label="الاسم" className="md:col-span-2">
        <Input name="name" defaultValue={m?.name ?? ""} required maxLength={120} placeholder="التوصيل القياسي داخل المملكة" />
      </Field>
      <Field label="الوصف / مدة التوصيل" className="md:col-span-4">
        <Input name="description" defaultValue={m?.description ?? ""} maxLength={300} placeholder="من 3 إلى 5 أيام عمل" />
      </Field>
      <Field label="السعر (ر.س)" hint="0 = مجاني">
        <Input name="price" dir="ltr" inputMode="decimal" defaultValue={halalasToInput(m?.price ?? 0)} required />
      </Field>
      <Field label="مجاني للطلبات فوق (ر.س)" hint="فارغ = بلا شحن مجاني" className="md:col-span-2">
        <Input name="freeAbove" dir="ltr" inputMode="decimal" defaultValue={halalasToInput(m?.freeAbove)} />
      </Field>
      <Field label="الترتيب">
        <Input name="position" dir="ltr" inputMode="numeric" defaultValue={m?.position ?? nextPosition ?? 0} />
      </Field>
      <div className="flex items-end pb-2.5 md:col-span-2">
        <Checkbox name="isActive" defaultChecked={m ? m.isActive : true} label="مفعّلة (تظهر في صفحة الدفع)" />
      </div>
    </div>
  );
}

export default async function AdminShippingPage() {
  const rows = await db.select().from(shippingMethods).orderBy(asc(shippingMethods.position), asc(shippingMethods.id));
  const active = rows.filter((r) => r.isActive).length;

  return (
    <>
      <PageHeader title="الشحن" subtitle="طرق الشحن التي يختار منها العميل عند إتمام الطلب" />

      {active === 0 ? (
        <p className="mb-4 rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm font-medium text-amber-800">
          لا توجد طريقة شحن مفعّلة — لن يتمكن العملاء من إتمام الطلب حتى تفعّل واحدة على الأقل.
        </p>
      ) : null}

      <Card title="طرق الشحن" padded={false} className="mb-6">
        {rows.length ? (
          <ul className="divide-y divide-line/70">
            {rows.map((m) => (
              <li key={m.id}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-3.5 hover:bg-paper-card">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{m.name}</span>
                      {m.description ? <span className="block truncate text-xs text-ink-mute">{m.description}</span> : null}
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge>{m.price ? formatSar(m.price) : "مجاني"}</Badge>
                      {m.freeAbove ? <Badge tone="blue">مجاني فوق {formatSar(m.freeAbove)}</Badge> : null}
                      <Badge tone={m.isActive ? "green" : "neutral"}>{m.isActive ? "مفعّلة" : "متوقفة"}</Badge>
                      <span className="text-xs font-semibold text-ink-mute group-open:hidden">تعديل</span>
                    </span>
                  </summary>
                  <div className="border-t border-line/70 bg-paper-card px-5 py-4">
                    <ActionForm action={saveShippingAction}>
                      <input type="hidden" name="id" value={m.id} />
                      <Fields m={m} />
                      <div className="mt-4">
                        <SubmitButton variant="dark" size="sm">
                          حفظ
                        </SubmitButton>
                      </div>
                    </ActionForm>
                    <ActionForm action={deleteShippingAction} className="mt-3 border-t border-line pt-3">
                      <input type="hidden" name="id" value={m.id} />
                      <ConfirmButton message={`حذف طريقة الشحن «${m.name}»؟`}>حذف</ConfirmButton>
                    </ActionForm>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>لا توجد طرق شحن. أضف واحدة بالأسفل.</EmptyState>
        )}
      </Card>

      <Card title="إضافة طريقة شحن">
        <ActionForm action={saveShippingAction} resetOnSuccess>
          <Fields nextPosition={rows.length} />
          <div className="mt-4">
            <SubmitButton>إضافة</SubmitButton>
          </div>
        </ActionForm>
      </Card>
    </>
  );
}
