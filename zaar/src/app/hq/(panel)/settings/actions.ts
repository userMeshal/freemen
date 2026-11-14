"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/dash/client";
import { getHq } from "@/lib/auth";
import { latinDigits } from "@/lib/money";
import { savePlatform } from "@/lib/platform";

/**
 * يقرأ رقمًا من حقل نصي: يقبل الأرقام العربية والفاصلة العشرية العربية (٫).
 * لا نحوّل الفاصلة (,) إلى نقطة حتى لا يُقرأ «1,000» على أنه 1.
 */
function readNumber(v: FormDataEntryValue | null): number {
  const s = latinDigits(String(v ?? ""))
    .replace(/٫/g, ".")
    .trim();
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : Number.NaN;
}

/** هل للقيمة خانتان عشريتان على الأكثر؟ */
const twoDecimals = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;

const schema = z.object({
  feePercent: z
    .number({ error: "نسبة العمولة: أدخل رقمًا مثل 2.5" })
    .min(0, "نسبة العمولة يجب أن تكون بين 0 و 20%")
    .max(20, "نسبة العمولة يجب أن تكون بين 0 و 20%")
    .refine(twoDecimals, "نسبة العمولة: خانتان عشريتان كحد أقصى"),
  feeFixed: z
    .number({ error: "الرسم الثابت: أدخل مبلغًا بالريال مثل 1" })
    .min(0, "الرسم الثابت يجب أن يكون بين 0 و 20 ر.س")
    .max(20, "الرسم الثابت يجب أن يكون بين 0 و 20 ر.س")
    .refine(twoDecimals, "الرسم الثابت: خانتان عشريتان كحد أقصى"),
  guaranteeDays: z
    .number({ error: "مدة الضمان: أدخل عدد أيام صحيحًا" })
    .int("مدة الضمان: أدخل عدد أيام صحيحًا")
    .min(1, "مدة الضمان يجب أن تكون بين 1 و 60 يومًا")
    .max(60, "مدة الضمان يجب أن تكون بين 1 و 60 يومًا"),
  claimReplyHours: z
    .number({ error: "مهلة رد التاجر: أدخل عدد ساعات صحيحًا" })
    .int("مهلة رد التاجر: أدخل عدد ساعات صحيحًا")
    .min(6, "مهلة رد التاجر يجب أن تكون بين 6 و 168 ساعة")
    .max(168, "مهلة رد التاجر يجب أن تكون بين 6 و 168 ساعة"),
  payoutHoldDays: z
    .number({ error: "أيام الحجز: أدخل عدد أيام صحيحًا" })
    .int("أيام الحجز: أدخل عدد أيام صحيحًا")
    .min(0, "أيام الحجز يجب أن تكون بين 0 و 30")
    .max(30, "أيام الحجز يجب أن تكون بين 0 و 30"),
  payoutMin: z
    .number({ error: "أقل مبلغ للتحويل: أدخل مبلغًا بالريال مثل 10" })
    .min(0, "أقل مبلغ للتحويل يجب أن يكون بين 0 و 1000 ر.س")
    .max(1000, "أقل مبلغ للتحويل يجب أن يكون بين 0 و 1000 ر.س")
    .refine(twoDecimals, "أقل مبلغ للتحويل: خانتان عشريتان كحد أقصى"),
});

export async function saveSettings(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!(await getHq())) return { ok: false, error: "سجّل دخولك من جديد" };

  const parsed = schema.safeParse({
    feePercent: readNumber(form.get("feePercent")),
    feeFixed: readNumber(form.get("feeFixed")),
    guaranteeDays: readNumber(form.get("guaranteeDays")),
    claimReplyHours: readNumber(form.get("claimReplyHours")),
    payoutHoldDays: readNumber(form.get("payoutHoldDays")),
    payoutMin: readNumber(form.get("payoutMin")),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "تحقق من القيم المدخلة" };
  const v = parsed.data;

  await savePlatform({
    feeBp: Math.round(v.feePercent * 100),
    feeFixed: Math.round(v.feeFixed * 100),
    guaranteeDays: v.guaranteeDays,
    claimReplyHours: v.claimReplyHours,
    payoutHoldDays: v.payoutHoldDays,
    payoutMin: Math.round(v.payoutMin * 100),
  });
  // الإعدادات تظهر في المتاجر ولوحات التجار أيضًا (مدة الضمان، العمولة)، فنحدّث كل الصفحات
  revalidatePath("/", "layout");
  return { ok: true, message: "حُفظت الإعدادات. العمولة الجديدة تُطبَّق على الطلبات التي تُدفع من الآن." };
}
