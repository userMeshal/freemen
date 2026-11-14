"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { claims, orders } from "@/db/schema";
import type { ActionState } from "@/components/dash/client";
import { merchantStore } from "@/lib/auth";
import { merchantReply } from "@/lib/claims";
import { latinDigits } from "@/lib/money";
import { advanceOrder, refundOrder } from "@/lib/orders";
import { NO_SESSION, SHIPPING_COMPANIES, done, fail, idOf, text, zodFail } from "../_lib/form";

const UNKNOWN = "طلب غير معروف";

function refresh() {
  revalidatePath("/dashboard", "layout");
}

export async function startProcessing(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await merchantStore();
  if (!ctx) return NO_SESSION;
  const id = idOf(form);
  if (!id) return fail(UNKNOWN);
  const error = await advanceOrder(ctx.store.id, id, "processing");
  if (error) return fail(error);
  refresh();
  return done("بدأ تجهيز الطلب");
}

const Shipment = z.object({
  company: z.enum(SHIPPING_COMPANIES, "اختر شركة الشحن"),
  tracking: z.string().regex(/^[A-Za-z0-9-]{0,40}$/, "رقم التتبع: أرقام وحروف إنجليزية فقط"),
});

export async function shipOrder(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await merchantStore();
  if (!ctx) return NO_SESSION;
  const id = idOf(form);
  if (!id) return fail(UNKNOWN);
  const parsed = Shipment.safeParse({ company: text(form, "company", 40), tracking: latinDigits(text(form, "tracking", 60)).replace(/\s/g, "") });
  if (!parsed.success) return zodFail(parsed.error);
  const error = await advanceOrder(ctx.store.id, id, "shipped", parsed.data);
  if (error) return fail(error);
  refresh();
  return done("تم تسجيل الشحن");
}

export async function deliverOrder(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await merchantStore();
  if (!ctx) return NO_SESSION;
  const id = idOf(form);
  if (!id) return fail(UNKNOWN);
  const error = await advanceOrder(ctx.store.id, id, "delivered");
  if (error) return fail(error);
  refresh();
  return done("تم تسجيل التوصيل");
}

export async function refundFull(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await merchantStore();
  if (!ctx) return NO_SESSION;
  const id = idOf(form);
  if (!id) return fail(UNKNOWN);
  const [order] = await db
    .select({ id: orders.id, paymentStatus: orders.paymentStatus })
    .from(orders)
    .where(and(eq(orders.id, id), eq(orders.storeId, ctx.store.id)))
    .limit(1);
  if (!order) return fail(UNKNOWN);
  if (order.paymentStatus !== "paid") return fail("هذا الطلب غير مدفوع أو سبق استرداده");

  // لو على الطلب مطالبة ضمان مفتوحة، نغلقها بالموافقة حتى لا تبقى معلّقة بعد الاسترداد
  const [claim] = await db
    .select({ id: claims.id })
    .from(claims)
    .where(and(eq(claims.orderId, order.id), eq(claims.storeId, ctx.store.id), eq(claims.status, "open")))
    .limit(1);
  let message = "تم اعتماد الاسترداد";
  if (claim) {
    const error = await merchantReply(ctx.store.id, claim.id, true, "استرداد من التاجر");
    if (error) return fail(error);
  } else {
    const result = await refundOrder(order.id, "استرداد من التاجر", "merchant");
    if (!result.ok) return fail("تعذّر الاسترداد — حدّث الصفحة وتأكد من حالة الطلب");
    message = result.refund === "gateway" ? "رجع المبلغ للعميل عبر بوابة الدفع" : "تم تسجيل الاسترداد — فريق زار يحوّل المبلغ للعميل";
  }
  refresh();
  return done(message);
}
