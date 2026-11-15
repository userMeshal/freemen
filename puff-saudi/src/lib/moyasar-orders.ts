import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { paymentAttempts } from "@/db/schema";
import { classifyMoyasarStatus, fetchPayment, isUuid, orderNumberFromDescription } from "./moyasar";
import { markOrderPaid, markPaymentFailed } from "./orders";

type OrderRef = { id: number; number: string; total: number };

export type MoyasarOutcome = "paid" | "failed" | "pending" | "mismatch";

/**
 * يتحقق من عملية ميسر مباشرة من الـ API بالمفتاح السري ثم يحدّث الطلب.
 * لا نثق بما يرسله المتصفح أو الـ webhook: نطابق رقم الطلب (من الوصف المقفل) والمبلغ والعملة.
 * آمن للتكرار.
 */
export async function confirmMoyasarPayment(order: OrderRef, paymentId: string): Promise<MoyasarOutcome> {
  if (!isUuid(paymentId)) return "mismatch";
  const payment = await fetchPayment(paymentId);
  if (orderNumberFromDescription(payment.description) !== order.number) return "mismatch";

  const outcome = classifyMoyasarStatus(payment.status);
  if (outcome === "approved") {
    if (payment.amount !== order.total || (payment.currency || "").toUpperCase() !== "SAR") {
      console.error("[moyasar] amount mismatch", { order: order.number, got: payment.amount, expected: order.total });
      return "mismatch";
    }
    await markOrderPaid(order.id, payment.id, payment, "moyasar");
    return "paid";
  }
  if (outcome === "declined") {
    const seen = await db
      .select({ id: paymentAttempts.id })
      .from(paymentAttempts)
      .where(and(eq(paymentAttempts.orderId, order.id), eq(paymentAttempts.providerRef, payment.id), eq(paymentAttempts.status, "declined")))
      .limit(1);
    if (!seen.length) await markPaymentFailed(order.id, payment.id, payment.source?.message ?? null, payment, "moyasar");
    return "failed";
  }
  return "pending";
}

/** آخر عملية سجّلها المتصفح لهذا الطلب (قبل التحويل للتحقق البنكي) */
export async function latestMoyasarPaymentId(orderId: number): Promise<string | null> {
  const rows = await db
    .select({ ref: paymentAttempts.providerRef })
    .from(paymentAttempts)
    .where(and(eq(paymentAttempts.orderId, orderId), eq(paymentAttempts.provider, "moyasar"), eq(paymentAttempts.status, "created")))
    .orderBy(desc(paymentAttempts.id))
    .limit(1);
  return rows[0]?.ref ?? null;
}
