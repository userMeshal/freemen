"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { fail, firstError, ok, str, type ActionState } from "@/lib/admin-utils";

export async function saveCustomerNotesAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = z
    .object({ id: z.coerce.number().int().positive(), notes: z.string().max(2000, "الملاحظات طويلة جدًا") })
    .safeParse({ id: fd.get("id"), notes: str(fd, "notes") });
  if (!parsed.success) return fail(firstError(parsed.error));
  const res = await db
    .update(customers)
    .set({ notes: parsed.data.notes || null })
    .where(eq(customers.id, parsed.data.id))
    .returning({ id: customers.id });
  if (!res.length) return fail("العميل غير موجود");
  revalidatePath(`/admin/customers/${parsed.data.id}`);
  return ok("تم حفظ الملاحظات");
}
