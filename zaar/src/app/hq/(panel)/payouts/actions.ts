"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/dash/client";
import { getHq } from "@/lib/auth";
import { markPayoutFailed, markPayoutSent, runDailyPayouts } from "@/lib/ledger";
import { formatSar } from "@/lib/money";

const idSchema = z.coerce.number().int().positive();
const sentSchema = z.object({
  id: idSchema,
  reference: z.string().trim().min(3, "اكتب مرجع الحوالة البنكية (3 أحرف على الأقل)").max(80, "المرجع طويل (80 حرفًا كحد أقصى)"),
});
const failedSchema = z.object({
  id: idSchema,
  reason: z.string().trim().min(3, "اكتب سبب فشل التحويل (3 أحرف على الأقل)").max(80, "السبب طويل (80 حرفًا كحد أقصى)"),
});

const STALE = "هذا التحويل لم يعد بانتظار التنفيذ (ربما حُدّث من جلسة أخرى). حدّث الصفحة.";

/** تشغيل تسوية اليوم يدويًا — آمن للتكرار: لكل متجر تحويل واحد في اليوم */
export async function runPayoutsNow(_prev: ActionState, _form: FormData): Promise<ActionState> {
  if (!(await getHq())) return { ok: false, error: "سجّل دخولك من جديد" };
  try {
    const r = await runDailyPayouts();
    revalidatePath("/hq", "layout");
    const skipped = r.skippedNoIban > 0 ? ` متاجر تُخطّيت لأن التاجر لم يضف الآيبان: ${r.skippedNoIban}.` : "";
    if (r.created === 0) return { ok: true, message: `لا توجد تحويلات جديدة مستحقة اليوم.${skipped}` };
    return { ok: true, message: `تحويلات جديدة أُنشئت: ${r.created} — الإجمالي ${formatSar(r.total)}.${skipped}` };
  } catch (e) {
    console.error("[hq] runDailyPayouts failed", e);
    return { ok: false, error: "تعذّر تشغيل التسوية. حاول مرة أخرى." };
  }
}

export async function payoutSent(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!(await getHq())) return { ok: false, error: "سجّل دخولك من جديد" };
  const parsed = sentSchema.safeParse({ id: form.get("id"), reference: form.get("reference") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };

  const ok = await markPayoutSent(parsed.data.id, parsed.data.reference);
  revalidatePath("/hq", "layout");
  return ok ? { ok: true, message: "سُجّل التحويل كمُرسَل" } : { ok: false, error: STALE };
}

export async function payoutFailed(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!(await getHq())) return { ok: false, error: "سجّل دخولك من جديد" };
  const parsed = failedSchema.safeParse({ id: form.get("id"), reason: form.get("reason") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };

  const ok = await markPayoutFailed(parsed.data.id, parsed.data.reason);
  revalidatePath("/hq", "layout");
  return ok ? { ok: true, message: "سُجّل فشل التحويل ورجع المبلغ لرصيد التاجر" } : { ok: false, error: STALE };
}
