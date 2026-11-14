import { NextResponse } from "next/server";
import { verifyWebhookSignature, type WebhookPayload } from "@/lib/payments/edfapay";
import { orderByRef, settleOrder } from "@/lib/payments/settle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Webhook من EdfaPay. نتحقق من التوقيع (HMAC-SHA256) إن كان السر مضبوطًا،
 * ثم نسأل البوابة مباشرة عن حالة العملية ونطابق المرجع والمبلغ قبل تأكيد الدفع.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (verifyWebhookSignature(raw, req.headers.get("x-edfapay-signature")) === "invalid") {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  let payload: WebhookPayload;
  try {
    payload = JSON.parse(raw) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const order = await orderByRef(String(payload.orderId ?? ""));
  if (!order || order.gateway !== "edfapay" || !payload.transactionId) return NextResponse.json({ received: true, ignored: true });
  await settleOrder(order, String(payload.transactionId));
  return NextResponse.json({ received: true });
}
