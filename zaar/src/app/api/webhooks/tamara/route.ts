import { NextResponse, type NextRequest } from "next/server";
import { orderByRef, settleOrder } from "@/lib/payments/settle";
import { tamaraVerifyNotification } from "@/lib/payments/tamara";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** إشعارات تمارا: نتحقق من tamaraToken (JWT) ثم نعتمد الطلب عبر API تمارا */
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("tamaraToken") || req.headers.get("authorization");
  if (!(await tamaraVerifyNotification(token))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { order_id?: string; order_reference_id?: string } | null;
  const order = await orderByRef(String(body?.order_reference_id ?? ""));
  if (!order || order.gateway !== "tamara") return NextResponse.json({ received: true, ignored: true });
  await settleOrder(order, body?.order_id ?? null);
  return NextResponse.json({ received: true });
}
