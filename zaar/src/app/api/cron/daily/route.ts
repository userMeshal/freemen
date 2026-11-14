import { timingSafeEqual } from "node:crypto";
import { and, eq, isNull, lt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { stores } from "@/db/schema";
import { autoApproveExpiredClaims } from "@/lib/claims";
import { runDailyPayouts } from "@/lib/ledger";
import { cancelStaleUnpaidOrders } from "@/lib/orders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * المهمة اليومية (Vercel Cron — 00:05 بتوقيت الرياض):
 *  1) إلغاء الطلبات التي لم يكتمل دفعها وإعادة مخزونها
 *  2) اعتماد طلبات ضمان زار التي تجاوز التاجر مهلة الرد عليها
 *  3) إنشاء التحويل اليومي لكل متجر
 *  4) حذف المسودات غير المربوطة بحساب بعد 14 يومًا
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  if (!secret || got.length !== want.length || !timingSafeEqual(got, want)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const cancelled = await cancelStaleUnpaidOrders();
  const autoApproved = await autoApproveExpiredClaims();
  const payouts = await runDailyPayouts();
  const drafts = await db
    .delete(stores)
    .where(and(eq(stores.status, "draft"), isNull(stores.merchantId), lt(stores.createdAt, new Date(Date.now() - 14 * 24 * 3600 * 1000))))
    .returning({ id: stores.id });
  return NextResponse.json({ ok: true, cancelled, autoApproved, payouts, draftsDeleted: drafts.length });
}
