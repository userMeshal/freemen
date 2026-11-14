import "server-only";
import { and, eq, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { claims, orders, type Claim, type Order } from "@/db/schema";
import { refundOrder } from "./orders";
import { getPlatform, type PlatformConfig } from "./platform";

/**
 * ضمان زار: أي طلب مدفوع عبر المنصة يحق لعميله طلب استرداد كامل المبلغ
 * من لحظة الدفع وحتى `guaranteeDays` يومًا بعد التوصيل.
 * التاجر يرد خلال `claimReplyHours` ساعة (يوافق أو يعترض)، وإن لم يرد يُعتمد الاسترداد تلقائيًا.
 * عند الاعتراض تحسم إدارة زار.
 */

export const CLAIM_REASONS: Record<string, string> = {
  not_received: "لم يصلني الطلب",
  not_as_described: "المنتج مختلف عن الوصف",
  defective: "المنتج تالف أو به عيب",
  wrong_item: "وصلني منتج خاطئ",
  changed_mind: "غيّرت رأيي وأرغب بالإرجاع",
};

export function guaranteeEndsAt(order: Order, cfg: PlatformConfig): Date | null {
  if (order.paymentStatus !== "paid" || !order.paidAt) return null;
  if (!order.deliveredAt) return null; // مفتوح حتى التوصيل
  return new Date(order.deliveredAt.getTime() + cfg.guaranteeDays * 24 * 3600 * 1000);
}

export function claimEligibility(order: Order, existing: Claim | null, cfg: PlatformConfig): { ok: boolean; reason: string } {
  if (existing) return { ok: false, reason: "يوجد طلب استرداد مسجّل لهذا الطلب" };
  if (order.paymentStatus === "refunded") return { ok: false, reason: "تم استرداد مبلغ هذا الطلب" };
  if (order.paymentStatus !== "paid") return { ok: false, reason: "الطلب غير مدفوع" };
  const ends = guaranteeEndsAt(order, cfg);
  if (ends && ends.getTime() < Date.now()) return { ok: false, reason: `انتهت مدة ضمان زار (${cfg.guaranteeDays} يومًا بعد التوصيل)` };
  return { ok: true, reason: "" };
}

export async function openClaim(order: Order, reason: string, details: string): Promise<{ ok: boolean; error?: string }> {
  const cfg = await getPlatform();
  if (!CLAIM_REASONS[reason]) return { ok: false, error: "اختر سبب الاسترداد" };
  const existing = await db.select().from(claims).where(eq(claims.orderId, order.id)).limit(1);
  const el = claimEligibility(order, existing[0] ?? null, cfg);
  if (!el.ok) return { ok: false, error: el.reason };
  const rows = await db
    .insert(claims)
    .values({ storeId: order.storeId, orderId: order.id, reason, details: details.slice(0, 1000), amount: order.total })
    .onConflictDoNothing({ target: claims.orderId })
    .returning({ id: claims.id });
  return rows.length ? { ok: true } : { ok: false, error: "يوجد طلب استرداد مسجّل لهذا الطلب" };
}

async function approve(claim: Claim, resolution: string, by: "merchant" | "zaar" | "system") {
  const moved = await db
    .update(claims)
    .set({ status: "approved", resolution, resolvedAt: new Date() })
    .where(and(eq(claims.id, claim.id), inArray(claims.status, ["open", "merchant_replied"])))
    .returning({ id: claims.id });
  if (!moved.length) return false;
  await refundOrder(claim.orderId, `استرداد عبر ضمان زار — ${resolution}`, by === "system" ? "zaar" : by);
  return true;
}

/** رد التاجر: يوافق على الاسترداد مباشرة، أو يعترض ويشرح فتُحال لإدارة زار */
export async function merchantReply(storeId: number, claimId: number, accept: boolean, reply: string): Promise<string | null> {
  const [claim] = await db
    .select()
    .from(claims)
    .where(and(eq(claims.id, claimId), eq(claims.storeId, storeId)))
    .limit(1);
  if (!claim || claim.status !== "open") return "لا يمكن الرد على هذا الطلب";
  if (accept) {
    await db.update(claims).set({ merchantReply: reply.slice(0, 1000), repliedAt: new Date() }).where(eq(claims.id, claim.id));
    await approve(claim, "وافق التاجر على الاسترداد", "merchant");
    return null;
  }
  if (reply.trim().length < 10) return "اشرح سبب الاعتراض (10 أحرف على الأقل)";
  await db
    .update(claims)
    .set({ status: "merchant_replied", merchantReply: reply.slice(0, 1000), repliedAt: new Date() })
    .where(and(eq(claims.id, claim.id), eq(claims.status, "open")));
  return null;
}

/** قرار إدارة زار */
export async function resolveClaim(claimId: number, approveIt: boolean, note: string): Promise<string | null> {
  const [claim] = await db.select().from(claims).where(eq(claims.id, claimId)).limit(1);
  if (!claim || !["open", "merchant_replied"].includes(claim.status)) return "تم حسم هذا الطلب مسبقًا";
  if (approveIt) {
    await approve(claim, note || "قرار إدارة زار: استرداد كامل", "zaar");
    return null;
  }
  if (note.trim().length < 10) return "اكتب سبب الرفض ليظهر للعميل";
  const rows = await db
    .update(claims)
    .set({ status: "rejected", resolution: note.slice(0, 1000), resolvedAt: new Date() })
    .where(and(eq(claims.id, claim.id), inArray(claims.status, ["open", "merchant_replied"])))
    .returning({ id: claims.id });
  return rows.length ? null : "تم حسم هذا الطلب مسبقًا";
}

/** يعتمد تلقائيًا الطلبات التي تجاوز التاجر مهلة الرد عليها */
export async function autoApproveExpiredClaims(): Promise<number> {
  const cfg = await getPlatform();
  const cutoff = new Date(Date.now() - cfg.claimReplyHours * 3600 * 1000);
  const expired = await db
    .select()
    .from(claims)
    .where(and(eq(claims.status, "open"), lt(claims.createdAt, cutoff)))
    .limit(100);
  let n = 0;
  for (const c of expired) n += (await approve(c, `لم يرد التاجر خلال ${cfg.claimReplyHours} ساعة`, "system")) ? 1 : 0;
  return n;
}

export async function confirmManualRefund(claimId: number): Promise<boolean> {
  const rows = await db
    .update(claims)
    .set({ refundState: "manual_done" })
    .where(and(eq(claims.id, claimId), eq(claims.refundState, "manual_pending")))
    .returning({ id: claims.id });
  return rows.length > 0;
}

export async function orderOfClaim(claim: Claim): Promise<Order> {
  const [o] = await db.select().from(orders).where(eq(orders.id, claim.orderId)).limit(1);
  return o;
}
