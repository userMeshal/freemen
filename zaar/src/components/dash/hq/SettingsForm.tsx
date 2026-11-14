"use client";

import { useActionState, useState } from "react";
import { Check } from "lucide-react";
import { Submit, type FormAction } from "@/components/dash/client";

export type SettingsValues = {
  feePercent: string;
  feeFixed: string;
  guaranteeDays: string;
  claimReplyHours: string;
  payoutHoldDays: string;
  payoutMin: string;
};

type Key = keyof SettingsValues;

const toLatin = (s: string) => s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/٫/g, ".");
const sar = (halalas: number) => (halalas / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * نموذج إعدادات المنصة. الحقول مضبوطة بالحالة (controlled) حتى لا تضيع القيم المكتوبة
 * إذا رفض الخادم إحداها — React يعيد ضبط النماذج غير المضبوطة بعد كل إجراء.
 */
export function SettingsForm({ action, initial }: { action: FormAction; initial: SettingsValues }) {
  const [state, run] = useActionState(action, null);
  const [v, setV] = useState<SettingsValues>(initial);
  const bind = (name: Key) => ({
    id: `set-${name}`,
    name,
    value: v[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV((old) => ({ ...old, [name]: e.target.value })),
    required: true,
    dir: "ltr" as const,
    autoComplete: "off",
    className: "dash-input num",
  });

  // مثال حي على العمولة بنفس معادلة المنصة: النسبة + الرسم الثابت، ولا تتجاوز مبلغ الطلب
  const pct = Number(toLatin(v.feePercent));
  const fixed = Number(toLatin(v.feeFixed));
  const exampleOk = v.feePercent.trim() !== "" && v.feeFixed.trim() !== "" && Number.isFinite(pct) && Number.isFinite(fixed) && pct >= 0 && fixed >= 0;
  const EXAMPLE = 20000;
  const fee = exampleOk ? Math.min(EXAMPLE, Math.round((EXAMPLE * Math.round(pct * 100)) / 10000) + Math.round(fixed * 100)) : 0;

  const field = (name: Key, label: string, unit: string, hint: string, inputMode: "decimal" | "numeric") => (
    <div>
      <label htmlFor={`set-${name}`} className="dash-label">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input {...bind(name)} inputMode={inputMode} aria-describedby={`set-${name}-hint`} />
        <span className="w-12 shrink-0 text-sm font-medium text-ink/55">{unit}</span>
      </div>
      <p id={`set-${name}-hint`} className="mt-1.5 text-xs leading-relaxed text-ink/55">
        {hint}
      </p>
    </div>
  );

  return (
    <form action={run} className="space-y-6">
      <section className="dash-card p-5 md:p-6">
        <h2 className="font-display text-base font-bold">عمولة زار</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink/60">تُقتطع من كل طلب مدفوع: نسبة من إجمالي الطلب + رسم ثابت. التغيير يسري على الطلبات الجديدة فقط.</p>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {field("feePercent", "نسبة العمولة", "%", "من 0 إلى 20%، بخانتين عشريتين كحد أقصى. مثال: 2.5", "decimal")}
          {field("feeFixed", "الرسم الثابت لكل طلب", "ر.س", "من 0 إلى 20 ر.س. يُضاف إلى النسبة في كل طلب مدفوع.", "decimal")}
        </div>
        <p className="mt-4 rounded-2xl bg-ink/[0.05] px-4 py-3 text-sm leading-relaxed text-ink/75" aria-live="polite">
          {exampleOk ? (
            <>
              مثال: طلب بمبلغ <span className="num font-semibold">200.00</span> ر.س ← عمولة زار <span className="num font-semibold">{sar(fee)}</span> ر.س، وصافي التاجر{" "}
              <span className="num font-semibold">{sar(EXAMPLE - fee)}</span> ر.س.
            </>
          ) : (
            "أدخل النسبة والرسم الثابت لترى مثالًا على العمولة."
          )}
        </p>
      </section>

      <section className="dash-card p-5 md:p-6">
        <h2 className="font-display text-base font-bold">ضمان زار</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink/60">حق العميل في استرداد كامل المبلغ، ومهلة التاجر للرد على طلب الاسترداد.</p>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {field(
            "guaranteeDays",
            "مدة الضمان بعد التوصيل",
            "يوم",
            "من 1 إلى 60 يومًا. يستطيع العميل طلب الاسترداد من لحظة الدفع وحتى انتهاء هذه المدة بعد توصيل الطلب.",
            "numeric",
          )}
          {field(
            "claimReplyHours",
            "مهلة رد التاجر",
            "ساعة",
            "من 6 إلى 168 ساعة (7 أيام). إن لم يرد التاجر خلالها اعتُمد الاسترداد تلقائيًا.",
            "numeric",
          )}
        </div>
      </section>

      <section className="dash-card p-5 md:p-6">
        <h2 className="font-display text-base font-bold">التحويل اليومي</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink/60">متى تدخل مبيعات التاجر في التحويل، وأقل مبلغ يُنشأ له تحويل.</p>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {field(
            "payoutHoldDays",
            "أيام حجز المبلغ قبل التحويل",
            "يوم",
            "من 0 إلى 30. القيمة 0 تعني أن مبيعات اليوم تُحوَّل في اليوم التالي. حجز أطول يقلّل ما تتحمله زار إذا وصل طلب استرداد بعد أن حُوِّل المبلغ للتاجر.",
            "numeric",
          )}
          {field(
            "payoutMin",
            "أقل مبلغ للتحويل",
            "ر.س",
            "من 0 إلى 1000 ر.س. الرصيد الأقل من هذا المبلغ يبقى في محفظة التاجر ويُضاف إلى تحويل لاحق.",
            "decimal",
          )}
        </div>
      </section>

      <div>
        <Submit className="dash-btn dash-btn-ink" pendingText="جارٍ الحفظ…">
          حفظ الإعدادات
        </Submit>
        {state && !state.ok && state.error && (
          <p role="alert" className="mt-3 rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-700">
            {state.error}
          </p>
        )}
        {state?.ok && state.message && (
          <p role="status" className="mt-3 flex items-center gap-2 rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700">
            <Check size={16} className="shrink-0" /> {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
