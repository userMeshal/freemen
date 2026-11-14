"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { stores } from "@/db/schema";
import type { ActionState } from "@/components/dash/client";
import { getHq } from "@/lib/auth";

const idSchema = z.coerce.number().int().positive();

function refresh(id: number, slug?: string) {
  revalidatePath("/hq", "layout");
  revalidatePath(`/hq/stores/${id}`);
  // الواجهة العامة للمتجر يجب أن تعكس الإيقاف فورًا
  if (slug) revalidatePath(`/s/${slug}`, "layout");
}

/** إيقاف متجر منشور (live ← suspended). المسودات غير المربوطة بتاجر لا تُوقف. */
export async function suspendStore(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!(await getHq())) return { ok: false, error: "سجّل دخولك من جديد" };
  const id = idSchema.safeParse(form.get("id"));
  if (!id.success) return { ok: false, error: "متجر غير معروف" };

  const rows = await db
    .update(stores)
    .set({ status: "suspended", updatedAt: new Date() })
    .where(and(eq(stores.id, id.data), isNotNull(stores.merchantId), eq(stores.status, "live")))
    .returning({ slug: stores.slug });
  if (!rows.length) return { ok: false, error: "لا يمكن إيقاف هذا المتجر (ليس منشورًا أو غير مربوط بتاجر)" };
  refresh(id.data, rows[0].slug);
  return { ok: true, message: "تم إيقاف المتجر" };
}

/** إعادة تفعيل متجر موقوف (suspended ← live) */
export async function unsuspendStore(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!(await getHq())) return { ok: false, error: "سجّل دخولك من جديد" };
  const id = idSchema.safeParse(form.get("id"));
  if (!id.success) return { ok: false, error: "متجر غير معروف" };

  const rows = await db
    .update(stores)
    .set({ status: "live", updatedAt: new Date() })
    .where(and(eq(stores.id, id.data), isNotNull(stores.merchantId), eq(stores.status, "suspended")))
    .returning({ slug: stores.slug });
  if (!rows.length) return { ok: false, error: "هذا المتجر ليس موقوفًا" };
  refresh(id.data, rows[0].slug);
  return { ok: true, message: "تمت إعادة تفعيل المتجر" };
}

/**
 * حذف مسودة لم يستلمها أي تاجر ومضى على إنشائها أكثر من يوم.
 * الشروط كلها في جملة الحذف نفسها، ونمنع الحذف إن وُجد للمتجر أي طلب أو حركة مالية.
 */
export async function deleteDraftStore(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (!(await getHq())) return { ok: false, error: "سجّل دخولك من جديد" };
  const id = idSchema.safeParse(form.get("id"));
  if (!id.success) return { ok: false, error: "متجر غير معروف" };

  const cutoff = new Date(Date.now() - 24 * 3600 * 1000);
  const rows = await db
    .delete(stores)
    .where(
      and(
        eq(stores.id, id.data),
        isNull(stores.merchantId),
        eq(stores.status, "draft"),
        lt(stores.createdAt, cutoff),
        sql`not exists (select 1 from orders o where o.store_id = ${id.data})`,
        sql`not exists (select 1 from ledger l where l.store_id = ${id.data})`,
      ),
    )
    .returning({ id: stores.id });
  if (!rows.length) return { ok: false, error: "لا يمكن حذف هذا المتجر: الحذف للمسودات غير المربوطة بتاجر والأقدم من يوم فقط" };

  revalidatePath("/hq", "layout");
  redirect("/hq/stores");
}
