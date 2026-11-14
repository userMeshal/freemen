import { NextResponse, type NextRequest } from "next/server";
import { orderByRef, settleOrder } from "@/lib/payments/settle";
import { siteUrl } from "@/lib/platform";
import { storeOfOrder } from "@/lib/orders";
import { storePublicUrl } from "@/lib/stores";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * عودة العميل من بوابة الدفع. لا نثق بما في الرابط: نسأل البوابة عن الحالة ثم نحوّله لصفحة طلبه.
 * (صفحة الطلب تعيد الاستعلام إن تأخر تأكيد البوابة.)
 */
async function handle(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const order = await orderByRef(q.get("ref") ?? "");
  if (!order) return NextResponse.redirect(siteUrl(), 303);
  const hint = q.get("payment_id") || q.get("orderId") || q.get("transactionId") || q.get("trans_id");
  await settleOrder(order, hint && hint.length <= 80 ? hint : null).catch((e) => console.error("[pay/return]", e));
  const store = await storeOfOrder(order);
  return NextResponse.redirect(`${storePublicUrl(store.slug)}/order/${order.number}?t=${order.token}`, 303);
}

export const GET = handle;
export const POST = handle;
