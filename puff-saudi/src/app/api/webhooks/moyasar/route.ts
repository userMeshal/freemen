import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { isUuid, orderNumberFromDescription, verifyWebhook, webhookSecretMatches } from "@/lib/moyasar";
import { confirmMoyasarPayment } from "@/lib/moyasar-orders";
import { cancelStaleUnpaidOrders } from "@/lib/orders";
import { moyasarKeysPresent } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Event = {
  type?: string;
  secret_token?: string;
  data?: { id?: string; description?: string | null; webhook_id?: string; verification_code?: string };
};

/**
 * Webhook ميسر — احتياط لتأكيد الدفع عندما لا يعود العميل للموقع بعد التحقق البنكي.
 * 1) نتحقق من secret_token (السر المشترك الذي سُجّل به الـ webhook).
 * 2) لا نثق بمحتوى الإشعار: نجلب العملية من API ميسر بالمفتاح السري ونطابق الطلب والمبلغ.
 * 3) حدث webhook_verification: نرسل رمز التفعيل تلقائيًا ليبدأ الـ webhook بالعمل.
 */
export async function POST(req: Request) {
  if (!moyasarKeysPresent()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  let event: Event;
  try {
    event = (await req.json()) as Event;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!webhookSecretMatches(event.secret_token)) return NextResponse.json({ error: "invalid token" }, { status: 401 });

  if (event.type === "webhook_verification") {
    const { webhook_id, verification_code } = event.data ?? {};
    if (webhook_id && verification_code && /^\d{4,8}$/.test(verification_code)) {
      await verifyWebhook(webhook_id, verification_code).catch((e) => console.error("[moyasar] webhook verify failed", e));
    }
    return NextResponse.json({ received: true });
  }

  const paymentId = event.data?.id;
  const number = orderNumberFromDescription(event.data?.description);
  if (!paymentId || !isUuid(paymentId) || !number || !["payment_paid", "payment_failed", "payment_faild"].includes(event.type ?? "")) {
    return NextResponse.json({ received: true, ignored: true });
  }
  const found = await db.select().from(orders).where(eq(orders.number, number)).limit(1);
  const order = found[0];
  if (!order || order.paymentMethod !== "moyasar") return NextResponse.json({ received: true, ignored: true });

  try {
    const outcome = await confirmMoyasarPayment(order, paymentId);
    await cancelStaleUnpaidOrders().catch(() => {});
    return NextResponse.json({ received: true, outcome });
  } catch (e) {
    console.error("[moyasar] webhook processing failed", e);
    // 5xx حتى يعيد ميسر المحاولة لاحقًا
    return NextResponse.json({ error: "temporary failure" }, { status: 502 });
  }
}
