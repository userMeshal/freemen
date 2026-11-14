"use server";

import { revalidatePath } from "next/cache";
import { and, eq, not } from "drizzle-orm";
import { db } from "@/db";
import { reviews } from "@/db/schema";
import type { ActionState } from "@/components/dash/client";
import { merchantStore } from "@/lib/auth";
import { NO_SESSION, done, fail, idOf } from "../_lib/form";

export async function toggleReview(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await merchantStore();
  if (!ctx) return NO_SESSION;
  const id = idOf(form);
  if (!id) return fail("تقييم غير معروف");
  const rows = await db
    .update(reviews)
    .set({ hidden: not(reviews.hidden) })
    .where(and(eq(reviews.id, id), eq(reviews.storeId, ctx.store.id)))
    .returning({ hidden: reviews.hidden });
  if (!rows.length) return fail("تقييم غير معروف");
  revalidatePath("/dashboard/reviews");
  revalidatePath(`/s/${ctx.store.slug}`, "layout");
  return done(rows[0].hidden ? "تم إخفاء التقييم" : "التقييم ظاهر في المتجر");
}
