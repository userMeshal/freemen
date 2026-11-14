import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, type Order } from "@/db/schema";
import { markOrderPaid, markPaymentFailed } from "../orders";
import { verifyPayment } from "./index";

/** يسأل البوابة عن حالة الدفع ويحدّث الطلب. آمن للتكرار (webhook + رابط العودة + استعلام صفحة الطلب). */
export async function settleOrder(order: Order, hint?: string | null): Promise<"paid" | "failed" | "pending"> {
  if (order.paymentStatus === "paid" || order.paymentStatus === "refunded") return "paid";
  if (order.status !== "pending_payment") return "failed";
  const r = await verifyPayment(order, hint);
  if (r.outcome === "paid") {
    await markOrderPaid(order.id, r.gatewayPaymentId);
    return "paid";
  }
  if (r.outcome === "failed") await markPaymentFailed(order.id, null);
  return r.outcome;
}

export async function orderByRef(ref: string): Promise<Order | null> {
  if (!ref || ref.length > 80) return null;
  const rows = await db.select().from(orders).where(eq(orders.paymentRef, ref)).limit(1);
  return rows[0] ?? null;
}
