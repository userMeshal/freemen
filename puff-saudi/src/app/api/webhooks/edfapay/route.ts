import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { classifyStatus, edfapayStatus, verifyWebhookSignature, type WebhookPayload } from "@/lib/edfapay";
import { cancelStaleUnpaidOrders, markOrderPaid, markPaymentFailed } from "@/lib/orders";
import { edfapayConfigured } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Webhook من EdfaPay — مصدر الحقيقة لحالة الدفع.
 * 1) نتحقق من التوقيع (HMAC-SHA256) إن كان EDFAPAY_WEBHOOK_SECRET مضبوطًا.
 * 2) نتحقق مرة ثانية من حالة العملية عبر Status API بمفتاحنا (دفاع متعدد الطبقات).
 * 3) نطابق رقم الطلب والمبلغ قبل تأكيد الدفع. المعالجة آمنة للتكرار.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = verifyWebhookSignature(raw, req.headers.get("x-edfapay-signature"));
  if (signature === "invalid") return NextResponse.json({ error: "invalid signature" }, { status: 401 });

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(raw) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const ref = String(payload.orderId ?? "");
  const number = ref.split("-")[0]?.toUpperCase();
  const type = (payload.type ?? "Purchase").toLowerCase();
  if (!number || !/^PF\d+$/.test(number) || !["purchase", "sale"].includes(type)) {
    // أحداث لا تخص طلبات المتجر (استرداد، ربط أجهزة…) — نقرّ بالاستلام فقط
    return NextResponse.json({ received: true, ignored: true });
  }

  const found = await db.select().from(orders).where(eq(orders.number, number)).limit(1);
  const order = found[0];
  if (!order) return NextResponse.json({ received: true, ignored: true });

  let outcome = classifyStatus(payload.status);
  let amount = Number(payload.amount);
  const transactionId = payload.transactionId ? String(payload.transactionId) : null;

  // التحقق المستقل من بوابة الدفع
  let verified = signature === "valid";
  if (transactionId && edfapayConfigured()) {
    const tx = await edfapayStatus(transactionId).catch(() => null);
    if (tx) {
      if (String(tx.orderId) !== ref) return NextResponse.json({ error: "order mismatch" }, { status: 400 });
      outcome = classifyStatus(tx.paymentStatus ?? tx.transactionStatus);
      amount = Number(tx.amount);
      verified = true;
    }
  }
  if (!verified) return NextResponse.json({ error: "unverified" }, { status: 401 });

  if (outcome === "approved") {
    if (!Number.isFinite(amount) || Math.round(amount * 100) !== order.total) {
      console.error("[edfapay] amount mismatch", { number, amount, expected: order.total });
      return NextResponse.json({ error: "amount mismatch" }, { status: 400 });
    }
    await markOrderPaid(order.id, transactionId, payload);
  } else if (outcome === "declined") {
    await markPaymentFailed(order.id, transactionId, payload.pgDetails?.reason ?? null, payload);
  }

  // فرصة لتنظيف الطلبات غير المدفوعة القديمة وتحرير مخزونها
  await cancelStaleUnpaidOrders().catch(() => {});
  return NextResponse.json({ received: true });
}
