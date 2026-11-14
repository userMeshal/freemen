import { desc } from "drizzle-orm";
import { db } from "@/db";
import { coupons } from "@/db/schema";
import { formatSar } from "@/lib/money";
import { dateToRiyadhLocal, fmtDateTime, halalasToInput } from "@/lib/admin-utils";
import { Badge, Card, Checkbox, EmptyState, Field, Input, PageHeader, Select } from "@/components/admin/ui";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/admin/client";
import { deleteCouponAction, saveCouponAction } from "./actions";

export const metadata = { title: "الكوبونات" };

type Row = typeof coupons.$inferSelect;

function describe(c: Row): string {
  if (c.type === "free_shipping") return "شحن مجاني";
  if (c.type === "percent") return `خصم ${c.value}%${c.maxDiscount ? ` (حتى ${formatSar(c.maxDiscount)})` : ""}`;
  return `خصم ${formatSar(c.value)}`;
}

function state(c: Row): { label: string; tone: "green" | "neutral" | "amber" | "red" } {
  const now = new Date();
  if (!c.isActive) return { label: "متوقف", tone: "neutral" };
  if (c.endsAt && c.endsAt < now) return { label: "منتهي", tone: "red" };
  if (c.startsAt && c.startsAt > now) return { label: "لم يبدأ", tone: "amber" };
  if (c.usageLimit !== null && c.usedCount >= c.usageLimit) return { label: "استُنفد", tone: "red" };
  return { label: "فعّال", tone: "green" };
}

function Fields({ c }: { c?: Row }) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Field label="رمز الكوبون" hint="أحرف إنجليزية وأرقام — يُحوَّل لأحرف كبيرة">
        <Input name="code" dir="ltr" defaultValue={c?.code ?? ""} required maxLength={40} placeholder="PUFF10" className="uppercase" />
      </Field>
      <Field label="النوع">
        <Select name="type" defaultValue={c?.type ?? "percent"}>
          <option value="percent">نسبة مئوية %</option>
          <option value="fixed">مبلغ ثابت (ر.س)</option>
          <option value="free_shipping">شحن مجاني</option>
        </Select>
      </Field>
      <Field label="القيمة" hint="نسبة 1–100 أو مبلغ بالريال. تُهمل مع الشحن المجاني">
        <Input
          name="value"
          dir="ltr"
          inputMode="decimal"
          defaultValue={c ? (c.type === "fixed" ? halalasToInput(c.value) : c.type === "percent" ? String(c.value) : "") : ""}
        />
      </Field>
      <Field label="أقصى خصم (ر.س)" hint="للنسبة المئوية فقط — اختياري">
        <Input name="maxDiscount" dir="ltr" inputMode="decimal" defaultValue={halalasToInput(c?.maxDiscount)} />
      </Field>
      <Field label="الحد الأدنى للطلب (ر.س)">
        <Input name="minSubtotal" dir="ltr" inputMode="decimal" defaultValue={c?.minSubtotal ? halalasToInput(c.minSubtotal) : ""} />
      </Field>
      <Field label="حد مرات الاستخدام" hint="فارغ = بلا حد">
        <Input name="usageLimit" dir="ltr" inputMode="numeric" defaultValue={c?.usageLimit ?? ""} />
      </Field>
      <Field label="يبدأ (توقيت الرياض)">
        <Input name="startsAt" type="datetime-local" dir="ltr" defaultValue={dateToRiyadhLocal(c?.startsAt)} />
      </Field>
      <Field label="ينتهي (توقيت الرياض)">
        <Input name="endsAt" type="datetime-local" dir="ltr" defaultValue={dateToRiyadhLocal(c?.endsAt)} />
      </Field>
      <div className="md:col-span-4">
        <Checkbox name="isActive" defaultChecked={c ? c.isActive : true} label="مفعّل" />
      </div>
    </div>
  );
}

export default async function AdminCouponsPage() {
  const rows = await db.select().from(coupons).orderBy(desc(coupons.createdAt), desc(coupons.id));

  return (
    <>
      <PageHeader title="الكوبونات" subtitle={`${rows.length} كوبون`} />

      <Card title="كوبون جديد" className="mb-6">
        <ActionForm action={saveCouponAction} resetOnSuccess>
          <Fields />
          <div className="mt-4">
            <SubmitButton>إنشاء الكوبون</SubmitButton>
          </div>
        </ActionForm>
      </Card>

      <Card title="كل الكوبونات" padded={false}>
        {rows.length ? (
          <ul className="divide-y divide-line/70">
            {rows.map((c) => {
              const s = state(c);
              return (
                <li key={c.id}>
                  <details className="group">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-3.5 hover:bg-paper-card">
                      <span className="flex min-w-0 flex-wrap items-center gap-3">
                        <span className="rounded-lg bg-ink px-2.5 py-1 font-mono text-xs font-bold text-lime" dir="ltr">
                          {c.code}
                        </span>
                        <span className="text-sm font-semibold">{describe(c)}</span>
                        {c.minSubtotal ? <span className="text-xs text-ink-mute">للطلبات من {formatSar(c.minSubtotal)}</span> : null}
                      </span>
                      <span className="flex flex-wrap items-center gap-2">
                        <Badge>
                          استُخدم {c.usedCount}
                          {c.usageLimit !== null ? ` / ${c.usageLimit}` : ""}
                        </Badge>
                        {c.endsAt ? <span className="text-xs text-ink-mute">حتى {fmtDateTime(c.endsAt)}</span> : null}
                        <Badge tone={s.tone}>{s.label}</Badge>
                        <span className="text-xs font-semibold text-ink-mute group-open:hidden">تعديل</span>
                      </span>
                    </summary>
                    <div className="border-t border-line/70 bg-paper-card px-5 py-4">
                      <ActionForm action={saveCouponAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <Fields c={c} />
                        <div className="mt-4">
                          <SubmitButton variant="dark" size="sm">
                            حفظ
                          </SubmitButton>
                        </div>
                      </ActionForm>
                      <ActionForm action={deleteCouponAction} className="mt-3 border-t border-line pt-3">
                        <input type="hidden" name="id" value={c.id} />
                        <ConfirmButton message={`حذف الكوبون ${c.code}؟`}>حذف الكوبون</ConfirmButton>
                      </ActionForm>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState>لا توجد كوبونات بعد.</EmptyState>
        )}
      </Card>
    </>
  );
}
