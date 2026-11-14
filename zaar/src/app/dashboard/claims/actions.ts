"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/dash/client";
import { merchantStore } from "@/lib/auth";
import { merchantReply } from "@/lib/claims";
import { NO_SESSION, done, fail, idOf, text } from "../_lib/form";

export async function acceptClaim(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await merchantStore();
  if (!ctx) return NO_SESSION;
  const id = idOf(form);
  if (!id) return fail("طلب استرداد غير معروف");
  const error = await merchantReply(ctx.store.id, id, true, "");
  if (error) return fail(error);
  revalidatePath("/dashboard", "layout");
  return done("تمت الموافقة على الاسترداد");
}

export async function objectClaim(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await merchantStore();
  if (!ctx) return NO_SESSION;
  const id = idOf(form);
  if (!id) return fail("طلب استرداد غير معروف");
  const reply = text(form, "reply", 1000);
  if (reply.length < 10) return fail("اشرح سبب الاعتراض (10 أحرف على الأقل)");
  const error = await merchantReply(ctx.store.id, id, false, reply);
  if (error) return fail(error);
  revalidatePath("/dashboard", "layout");
  return done("وصل اعتراضك لفريق زار وبيحسمون الطلب");
}
