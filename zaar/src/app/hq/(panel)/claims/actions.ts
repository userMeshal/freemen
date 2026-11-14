"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/dash/client";
import { getHq } from "@/lib/auth";
import { autoApproveExpiredClaims, confirmManualRefund, resolveClaim } from "@/lib/claims";

const idSchema = z.coerce.number().int().positive();
const decisionSchema = z.object({
  id: idSchema,
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().max(1000, "الملاحظة طويلة (1000 حرف كحد أقصى)"),
});

/** قرار إدارة زار في طلب استرداد: استرداد كامل، أو رفض بسبب يظهر للعميل */
export async function decideClaim(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!(await getHq())) return { ok: false, error: "سجّل دخولك من جديد" };
  const parsed = decisionSchema.safeParse({ id: form.get("id"), decision: form.get("decision"), note: form.get("note") ?? "" });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" };
  const { id, decision, note } = parsed.data;
  if (decision === "reject" && note.length < 10) return { ok: false, error: "اكتب سبب الرفض (10 أحرف على الأقل) لأنه يظهر للعميل" };

  try {
    const error = await resolveClaim(id, decision === "approve", note);
    revalidatePath("/hq", "layout");
    if (error) return { ok: false, error };
    return { ok: true, message: decision === "approve" ? "اعتُمد الاسترداد الكامل للعميل" : "رُفض طلب الاسترداد" };
  } catch (e) {
    console.error("[hq] resolveClaim failed", id, e);
    revalidatePath("/hq", "layout");
    return { ok: false, error: "تعذّر تنفيذ القرار. حدّث الصفحة وتحقق من حالة الطلب قبل إعادة المحاولة." };
  }
}

/** تأكيد أن الاسترداد اليدوي نُفّذ فعلًا من لوحة بوابة الدفع */
export async function confirmRefund(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!(await getHq())) return { ok: false, error: "سجّل دخولك من جديد" };
  const id = idSchema.safeParse(form.get("id"));
  if (!id.success) return { ok: false, error: "طلب غير معروف" };

  const ok = await confirmManualRefund(id.data);
  revalidatePath("/hq", "layout");
  return ok ? { ok: true, message: "سُجّل تأكيد الاسترداد" } : { ok: false, error: "هذا الطلب لا ينتظر استردادًا يدويًا (ربما أُكّد من قبل)" };
}

/** اعتماد الطلبات التي تجاوز التاجر مهلة الرد عليها (نفس ما تفعله المهمة اليومية) */
export async function approveExpiredNow(_prev: ActionState, _form: FormData): Promise<ActionState> {
  if (!(await getHq())) return { ok: false, error: "سجّل دخولك من جديد" };
  try {
    const n = await autoApproveExpiredClaims();
    revalidatePath("/hq", "layout");
    return { ok: true, message: n > 0 ? `طلبات اعتُمد استردادها تلقائيًا: ${n}` : "لا توجد طلبات انتهت مهلة رد التاجر عليها." };
  } catch (e) {
    console.error("[hq] autoApproveExpiredClaims failed", e);
    revalidatePath("/hq", "layout");
    return { ok: false, error: "تعذّر إكمال الاعتماد التلقائي. حدّث الصفحة وحاول مرة أخرى." };
  }
}
