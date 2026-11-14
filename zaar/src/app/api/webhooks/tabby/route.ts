import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { orderByRef, settleOrder } from "@/lib/payments/settle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(header: string | null): boolean {
  const secret = process.env.TABBY_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const a = Buffer.from(header.replace(/^Bearer\s+/i, ""));
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** إشعارات تابي: الترويسة السرية تثبت المصدر، والحالة الفعلية تُجلب من API تابي قبل التأكيد */
export async function POST(req: Request) {
  if (!authorized(req.headers.get("authorization"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { id?: string; order?: { reference_id?: string } } | null;
  const order = await orderByRef(String(body?.order?.reference_id ?? ""));
  if (!order || order.gateway !== "tabby") return NextResponse.json({ received: true, ignored: true });
  await settleOrder(order, body?.id ?? null);
  return NextResponse.json({ received: true });
}
