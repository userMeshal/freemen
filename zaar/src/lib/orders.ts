import "server-only";
import { and, eq, inArray, lt, ne, sql as dsql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import {
  abandonedCarts,
  claims,
  counters,
  coupons,
  customers,
  ledger,
  orderItems,
  orders,
  products,
  stores,
  type Order,
  type OrderItem,
  type OrderStatus,
  type Store,
} from "@/db/schema";
import { randomToken } from "./password";
import { refundPayment } from "./payments";
import { getPlatform, platformFee } from "./platform";
import { quoteCart, type CartInput } from "./pricing";
import type { OrderEvent, PaymentMethodId } from "./types";

const event = (type: string, note: string, by: OrderEvent["by"] = "system"): OrderEvent => ({ at: new Date().toISOString(), type, note, by });
const pushEvent = (e: OrderEvent) => dsql`${orders.events} || ${JSON.stringify([e])}::jsonb`;

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "بانتظار الدفع",
  paid: "مدفوع",
  processing: "قيد التجهيز",
  shipped: "تم الشحن",
  delivered: "تم التوصيل",
  cancelled: "ملغي",
  refunded: "مُسترد",
};

async function nextOrderNumber(tx: Tx): Promise<string> {
  const rows = await tx.execute<{ value: number }>(dsql`
    insert into counters (key, value) values ('order', 100001)
    on conflict (key) do update set value = counters.value + 1
    returning value
  `);
  return `ZR${(rows as unknown as { value: number }[])[0].value}`;
}

export type CheckoutInput = {
  lines: CartInput[];
  couponCode: string | null;
  method: PaymentMethodId;
  customer: { name: string; phone: string; email: string; city: string; address: string; notes: string };
};

export class CheckoutError extends Error {}

/** ينشئ الطلب ويحجز المخزون داخل معاملة واحدة. الدفع يبدأ بعده. */
export async function createOrder(store: Store, input: CheckoutInput): Promise<{ order: Order; items: OrderItem[] }> {
  const quote = await quoteCart(store, input.lines, input.couponCode);
  const lines = quote.lines.filter((l) => l.available);
  if (!lines.length) throw new CheckoutError("سلتك فارغة أو المنتجات غير متوفرة");
  if (quote.lines.some((l) => !l.available)) throw new CheckoutError("بعض المنتجات نفدت — حدّث سلتك");
  if (input.couponCode && quote.couponError) throw new CheckoutError(quote.couponError);

  return db.transaction(async (tx) => {
    // حجز المخزون: الشرط في جملة التحديث نفسها يمنع البيع الزائد عند التزامن
    const need = new Map<number, number>();
    for (const l of lines) need.set(l.productId, (need.get(l.productId) ?? 0) + l.qty);
    for (const [productId, qty] of need) {
      const ok = await tx
        .update(products)
        .set({ stock: dsql`case when ${products.stock} is null then null else ${products.stock} - ${qty} end` })
        .where(and(eq(products.id, productId), eq(products.storeId, store.id), dsql`(${products.stock} is null or ${products.stock} >= ${qty})`))
        .returning({ id: products.id });
      if (!ok.length) throw new CheckoutError("نفدت كمية أحد المنتجات قبل إتمام طلبك");
    }
    if (quote.coupon) {
      const ok = await tx
        .update(coupons)
        .set({ used: dsql`${coupons.used} + 1` })
        .where(and(eq(coupons.storeId, store.id), eq(coupons.code, quote.coupon.code), dsql`(${coupons.maxUses} is null or ${coupons.used} < ${coupons.maxUses})`))
        .returning({ id: coupons.id });
      if (!ok.length) throw new CheckoutError("استُنفد عدد مرات استخدام الكوبون");
    }

    const c = input.customer;
    const [customer] = await tx
      .insert(customers)
      .values({ storeId: store.id, name: c.name, phone: c.phone, email: c.email, city: c.city })
      .onConflictDoUpdate({ target: [customers.storeId, customers.phone], set: { name: c.name, city: c.city, ...(c.email ? { email: c.email } : {}) } })
      .returning({ id: customers.id });

    const number = await nextOrderNumber(tx);
    const [order] = await tx
      .insert(orders)
      .values({
        storeId: store.id,
        customerId: customer.id,
        number,
        token: randomToken(18),
        paymentMethod: input.method,
        customerName: c.name,
        customerPhone: c.phone,
        customerEmail: c.email,
        city: c.city,
        address: c.address,
        notes: c.notes,
        subtotal: quote.subtotal,
        discount: quote.discount,
        shipping: quote.shipping,
        total: quote.total,
        vat: quote.vat,
        couponCode: quote.coupon?.code ?? null,
        events: [event("created", "تم إنشاء الطلب", "customer")],
      })
      .returning();
    const items = await tx
      .insert(orderItems)
      .values(lines.map((l) => ({ orderId: order.id, productId: l.productId, name: l.name, optionValue: l.optionValue, unitPrice: l.unitPrice, qty: l.qty, image: l.image, art: l.art })))
      .returning();
    return { order, items };
  });
}

export async function setPaymentAttempt(orderId: number, ref: string, gateway: string, gatewayPaymentId: string | null) {
  await db.update(orders).set({ paymentRef: ref, gateway, gatewayPaymentId }).where(eq(orders.id, orderId));
}

/**
 * يؤكد الدفع — آمن للتكرار (webhook + رابط العودة قد يصلان معًا).
 * يسجّل في دفتر الأستاذ: + إجمالي الطلب، − عمولة زار. الصافي يدخل في التحويل اليومي للتاجر.
 */
export async function markOrderPaid(orderId: number, gatewayPaymentId: string | null): Promise<boolean> {
  const cfg = await getPlatform();
  return db.transaction(async (tx) => {
    const [order] = await tx
      .update(orders)
      .set({
        status: "paid",
        paymentStatus: "paid",
        paidAt: new Date(),
        ...(gatewayPaymentId ? { gatewayPaymentId } : {}),
        events: pushEvent(event("paid", "تم استلام الدفع")),
      })
      .where(and(eq(orders.id, orderId), eq(orders.paymentStatus, "unpaid"), inArray(orders.status, ["pending_payment"])))
      .returning();
    if (!order) return false;

    const fee = platformFee(order.total, cfg);
    await tx.update(orders).set({ platformFee: fee, net: order.total - fee }).where(eq(orders.id, order.id));
    await tx.insert(ledger).values([
      { storeId: order.storeId, orderId: order.id, type: "sale", amount: order.total, note: `طلب ${order.number}` },
      { storeId: order.storeId, orderId: order.id, type: "fee", amount: -fee, note: `عمولة زار — ${order.number}` },
    ]);

    if (order.customerId) {
      await tx
        .update(customers)
        .set({ ordersCount: dsql`${customers.ordersCount} + 1`, totalSpent: dsql`${customers.totalSpent} + ${order.total}`, lastOrderAt: new Date() })
        .where(eq(customers.id, order.customerId));
    }
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    for (const i of items) {
      if (i.productId) await tx.update(products).set({ sold: dsql`${products.sold} + ${i.qty}` }).where(eq(products.id, i.productId));
    }
    await tx
      .update(abandonedCarts)
      .set({ recovered: true })
      .where(and(eq(abandonedCarts.storeId, order.storeId), eq(abandonedCarts.phone, order.customerPhone)));
    return true;
  });
}

export async function markPaymentFailed(orderId: number, reason: string | null) {
  await db
    .update(orders)
    .set({ events: pushEvent(event("payment_failed", reason ? `لم يكتمل الدفع: ${reason}` : "لم يكتمل الدفع")) })
    .where(and(eq(orders.id, orderId), eq(orders.paymentStatus, "unpaid")));
}

async function restock(tx: Tx, orderId: number) {
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  for (const i of items) {
    if (!i.productId) continue;
    await tx
      .update(products)
      .set({ stock: dsql`case when ${products.stock} is null then null else ${products.stock} + ${i.qty} end` })
      .where(eq(products.id, i.productId));
  }
}

/** يلغي الطلبات التي لم يكتمل دفعها خلال ساعتين ويعيد مخزونها وكوبونها */
export async function cancelStaleUnpaidOrders(): Promise<number> {
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const stale = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.status, "pending_payment"), lt(orders.createdAt, cutoff)))
    .limit(100);
  let n = 0;
  for (const s of stale) n += (await cancelUnpaid(s.id, "انتهت مهلة الدفع")) ? 1 : 0;
  return n;
}

async function cancelUnpaid(orderId: number, note: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .update(orders)
      .set({ status: "cancelled", events: pushEvent(event("cancelled", note)) })
      .where(and(eq(orders.id, orderId), eq(orders.status, "pending_payment"), eq(orders.paymentStatus, "unpaid")))
      .returning();
    if (!order) return false;
    await restock(tx, order.id);
    if (order.couponCode) {
      await tx
        .update(coupons)
        .set({ used: dsql`greatest(${coupons.used} - 1, 0)` })
        .where(and(eq(coupons.storeId, order.storeId), eq(coupons.code, order.couponCode)));
    }
    return true;
  });
}

/** تحديث حالة الطلب من التاجر: تجهيز ← شحن ← توصيل */
export async function advanceOrder(
  storeId: number,
  orderId: number,
  to: "processing" | "shipped" | "delivered",
  shipment?: { company: string; tracking: string },
): Promise<string | null> {
  const allowed: Record<typeof to, OrderStatus[]> = { processing: ["paid"], shipped: ["paid", "processing"], delivered: ["shipped", "processing", "paid"] };
  const now = new Date();
  const notes = { processing: "بدأ تجهيز الطلب", shipped: `تم شحن الطلب${shipment?.company ? ` مع ${shipment.company}` : ""}`, delivered: "تم توصيل الطلب" };
  const rows = await db
    .update(orders)
    .set({
      status: to,
      ...(to === "shipped" ? { shippedAt: now, shippingCompany: shipment?.company ?? "", trackingNumber: shipment?.tracking ?? "" } : {}),
      ...(to === "delivered" ? { deliveredAt: now } : {}),
      events: pushEvent(event(to, notes[to], "merchant")),
    })
    .where(and(eq(orders.id, orderId), eq(orders.storeId, storeId), inArray(orders.status, allowed[to])))
    .returning({ id: orders.id });
  return rows.length ? null : "لا يمكن تغيير حالة هذا الطلب";
}

/**
 * استرداد كامل لطلب مدفوع (بمبادرة التاجر أو بقرار ضمان زار) — آمن للتكرار.
 * يخصم من رصيد التاجر كامل المبلغ ويعيد له عمولة زار، ثم يحاول ردّ المبلغ للعميل عبر بوابة الدفع.
 */
export async function refundOrder(orderId: number, note: string, by: OrderEvent["by"]): Promise<{ ok: boolean; refund: "gateway" | "manual" | null }> {
  const order = await db.transaction(async (tx) => {
    const [o] = await tx
      .update(orders)
      .set({ status: "refunded", paymentStatus: "refunded", events: pushEvent(event("refunded", note, by)) })
      .where(and(eq(orders.id, orderId), eq(orders.paymentStatus, "paid"), ne(orders.status, "refunded")))
      .returning();
    if (!o) return null;
    await tx.insert(ledger).values([
      { storeId: o.storeId, orderId: o.id, type: "refund", amount: -o.total, note: `استرداد ${o.number}` },
      { storeId: o.storeId, orderId: o.id, type: "fee_reversal", amount: o.platformFee, note: `إرجاع عمولة ${o.number}` },
    ]);
    if (o.customerId) {
      await tx
        .update(customers)
        .set({ ordersCount: dsql`greatest(${customers.ordersCount} - 1, 0)`, totalSpent: dsql`greatest(${customers.totalSpent} - ${o.total}, 0)` })
        .where(eq(customers.id, o.customerId));
    }
    await restock(tx, o.id);
    return o;
  });
  if (!order) return { ok: false, refund: null };
  const refund = await refundPayment(order, note);
  await db
    .update(claims)
    .set({ refundState: refund === "gateway" ? "gateway" : "manual_pending" })
    .where(eq(claims.orderId, order.id));
  return { ok: true, refund };
}

export async function getOrderForTracking(storeId: number, number: string, token: string) {
  const rows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.storeId, storeId), eq(orders.number, number.toUpperCase())))
    .limit(1);
  const order = rows[0];
  if (!order || order.token !== token) return null;
  const [items, claim] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, order.id)),
    db.select().from(claims).where(eq(claims.orderId, order.id)).limit(1),
  ]);
  return { order, items, claim: claim[0] ?? null };
}

export async function storeOfOrder(order: Order): Promise<Store> {
  const [s] = await db.select().from(stores).where(eq(stores.id, order.storeId)).limit(1);
  return s;
}
