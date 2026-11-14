"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { stores } from "@/db/schema";
import type { ActionState } from "@/components/dash/client";
import { merchantStore } from "@/lib/auth";
import { normalizeIban } from "@/lib/ledger";
import { rateLimit } from "@/lib/rate-limit";

export async function saveBank(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await merchantStore();
  if (!ctx) return { ok: false, error: "سجّل دخولك من جديد" };
  if (!(await rateLimit(`bank:${ctx.store.id}`, 10, 3600))) return { ok: false, error: "محاولات كثيرة — جرّب لاحقًا" };
  const holder = String(form.get("holder") ?? "").trim().slice(0, 80);
  const bank = String(form.get("bank") ?? "").trim().slice(0, 60);
  const iban = normalizeIban(String(form.get("iban") ?? ""));
  if (holder.length < 5) return { ok: false, error: "اكتب اسم صاحب الحساب كما هو في البنك" };
  if (!bank) return { ok: false, error: "اختر البنك" };
  if (!iban) return { ok: false, error: "رقم الآيبان غير صحيح — يبدأ بـ SA ويتكون من 24 خانة" };
  await db.update(stores).set({ bankHolder: holder, bankName: bank, iban, updatedAt: new Date() }).where(eq(stores.id, ctx.store.id));
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "تم حفظ الحساب البنكي — التحويل اليومي يوصل عليه" };
}
