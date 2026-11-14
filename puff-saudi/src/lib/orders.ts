import "server-only";
import { revalidateTag } from "next/cache";
import { and, eq, inArray, lt, sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import {
  coupons,
  customers,
  orderEvents,
  orderItems,
  orders,
  paymentAttempts,
  variants,
  type Address,
  type OrderStatus,
  type PaymentMethod,
} from "@/db/schema";
import { quoteCart } from "./pricing";
import { randomToken } from "./password";
import type { CartLineInput } from "./types";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "قيد المراجعة",
  processing: "قيد التجهيز",
  shipped: "تم الشحن",
  delivered: "تم التوصيل",
  cancelled: "ملغي",
};

export const PAYMENT_STATUS_LABEL = {
  unpaid: "غير مدفوع",
  paid: "مدفوع",
  failed: "فشل الدفع",
  refunded: "مُسترد",
} as const;

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  edfapay: "دفع إلكتروني (مدى / بطاقة / Apple Pay)",
  cod: "الدفع عند الاستلام",
};

export class CheckoutError extends Error {
  constructor(
    message: string,
    public code: "empty" | "changed" | "coupon" | "payment" | "shipping" = "changed",
  ) {
    super(message);
  }
}

export type CreateOrderInput = {
  items: CartLineInput[];
  /** الإجمالي الذي رآه العميل — نرفض الطلب لو تغيّر السعر */
  expectedTotal: number;
  couponCode?: string | null;
  shippingMethodId: number;
  paymentMethod: PaymentMethod;
  customer: { name: string; phone: string; email: string | null };
  address: Address;
  note?: string | null;
  loggedInCustomerId?: number | null;
};

export async function createOrder(input: CreateOrderInput) {
  let stockTouched = false;

  const order = await db.transaction(async (tx) => {
    const ids = input.items.map((i) => Number(i.variantId)).filter((n) => Number.isInteger(n) && n > 0);
    if (!ids.length) throw new CheckoutError("السلة فارغة", "empty");
    // قفل صفوف المتغيرات لمنع البيع الزائد عند الطلبات المتزامنة
    await tx.select({ id: variants.id }).from(variants).where(inArray(variants.id, ids)).for("update");

    const quote = await quoteCart(
      input.items,
      { couponCode: input.couponCode, shippingMethodId: input.shippingMethodId, paymentMethod: input.paymentMethod },
      tx,
    );
    if (!quote.lines.length) throw new CheckoutError("السلة فارغة", "empty");
    if (quote.removed.length || quote.adjusted)
      throw new CheckoutError("تغيّر توفر بعض المنتجات في سلتك. راجع السلة ثم أعد المحاولة.", "changed");
    if (input.couponCode && !quote.coupon) throw new CheckoutError(quote.couponError ?? "الكوبون غير صالح", "coupon");
    if (quote.shippingMethodId !== input.shippingMethodId)
      throw new CheckoutError("طريقة الشحن المختارة غير متاحة", "shipping");
    if (input.paymentMethod === "cod" && !quote.payment.cod)
      throw new CheckoutError("الدفع عند الاستلام غير متاح حاليًا", "payment");
    if (input.paymentMethod === "edfapay" && !quote.payment.edfapay)
      throw new CheckoutError("الدفع الإلكتروني غير متاح حاليًا", "payment");
    if (quote.total !== input.expectedTotal)
      throw new CheckoutError("تم تحديث الأسعار. راجع الإجمالي ثم أكّد الطلب من جديد.", "changed");

    // خصم المخزون (للمتغيرات محدودة المخزون فقط)
    for (const line of quote.lines) {
      const res = await tx
        .update(variants)
        .set({ stock: dsql`${variants.stock} - ${line.qty}` })
        .where(and(eq(variants.id, line.variantId), dsql`${variants.stock} is not null`))
        .returning({ stock: variants.stock });
      if (res.length) {
        stockTouched = true;
        if ((res[0].stock ?? 0) < 0) throw new CheckoutError("الكمية المطلوبة غير متوفرة", "changed");
      }
    }

    // الكوبون: زيادة العدّاد بشكل ذرّي مع احترام الحد
    if (quote.couponRow) {
      const res = await tx
        .update(coupons)
        .set({ usedCount: dsql`${coupons.usedCount} + 1` })
        .where(
          and(
            eq(coupons.id, quote.couponRow.id),
            dsql`(${coupons.usageLimit} is null or ${coupons.usedCount} < ${coupons.usageLimit})`,
          ),
        )
        .returning({ id: coupons.id });
      if (!res.length) throw new CheckoutError("تم استنفاد عدد مرات استخدام الكوبون", "coupon");
    }

    // العميل: المسجّل دخوله، أو سجل ضيف بحسب رقم الجوال
    let customerId = input.loggedInCustomerId ?? null;
    if (!customerId) {
      const existing = await tx.select().from(customers).where(eq(customers.phone, input.customer.phone)).limit(1);
      if (existing[0]) {
        customerId = existing[0].id;
        await tx
          .update(customers)
          .set({ address: input.address, name: existing[0].passwordHash ? existing[0].name : input.customer.name })
          .where(eq(customers.id, customerId));
      } else {
        let email = input.customer.email;
        if (email) {
          const clash = await tx.select({ id: customers.id }).from(customers).where(eq(customers.email, email)).limit(1);
          if (clash.length) email = null;
        }
        const created = await tx
          .insert(customers)
          .values({ name: input.customer.name, phone: input.customer.phone, email, address: input.address })
          .returning({ id: customers.id });
        customerId = created[0].id;
      }
    } else {
      await tx.update(customers).set({ address: input.address }).where(eq(customers.id, customerId));
    }

    const selectedShipping = quote.shippingOptions.find((m) => m.id === quote.shippingMethodId)!;
    const inserted = await tx
      .insert(orders)
      .values({
        number: `TMP-${randomToken(8)}`,
        accessToken: randomToken(24),
        customerId,
        status: "pending",
        paymentStatus: "unpaid",
        paymentMethod: input.paymentMethod,
        customerName: input.customer.name,
        customerPhone: input.customer.phone,
        customerEmail: input.customer.email,
        address: input.address,
        subtotal: quote.subtotal,
        discount: quote.discount,
        shipping: quote.shipping,
        codFee: quote.codFee,
        total: quote.total,
        vatAmount: quote.vatAmount,
        couponCode: quote.coupon?.code ?? null,
        shippingMethodName: selectedShipping.name,
        customerNote: input.note || null,
      })
      .returning();
    const number = `PF${100000 + inserted[0].id}`;
    await tx.update(orders).set({ number }).where(eq(orders.id, inserted[0].id));

    await tx.insert(orderItems).values(
      quote.lines.map((l) => ({
        orderId: inserted[0].id,
        productId: l.productId,
        variantId: l.variantId,
        name: l.name,
        optionValue: l.optionValue,
        sku: l.sku,
        imageUrl: l.imageUrl,
        unitPrice: l.unitPrice,
        qty: l.qty,
        total: l.total,
      })),
    );
    await tx.insert(orderEvents).values({
      orderId: inserted[0].id,
      type: "created",
      note: input.paymentMethod === "cod" ? "تم استلام طلبك — الدفع عند الاستلام" : "تم إنشاء الطلب بانتظار إتمام الدفع",
    });

    return { ...inserted[0], number, lines: quote.lines };
  });

  if (stockTouched) revalidateTag("catalog");
  return order;
}

/** إعادة المخزون وعدّاد الكوبون عند إلغاء طلب (مرة واحدة فقط لكل طلب) */
export async function releaseOrderResources(orderId: number) {
  let touched = false;
  await db.transaction(async (tx) => {
    const claimed = await tx
      .update(orders)
      .set({ stockReleased: true })
      .where(and(eq(orders.id, orderId), eq(orders.stockReleased, false)))
      .returning({ couponCode: orders.couponCode });
    if (!claimed.length) return;
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    for (const it of items) {
      if (!it.variantId) continue;
      const res = await tx
        .update(variants)
        .set({ stock: dsql`${variants.stock} + ${it.qty}` })
        .where(and(eq(variants.id, it.variantId), dsql`${variants.stock} is not null`))
        .returning({ id: variants.id });
      if (res.length) touched = true;
    }
    if (claimed[0].couponCode) {
      await tx
        .update(coupons)
        .set({ usedCount: dsql`greatest(${coupons.usedCount} - 1, 0)` })
        .where(eq(coupons.code, claimed[0].couponCode));
    }
  });
  if (touched) revalidateTag("catalog");
}

export async function cancelOrder(orderId: number, note: string, actor = "system") {
  const res = await db
    .update(orders)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(eq(orders.id, orderId), dsql`${orders.status} <> 'cancelled'`))
    .returning({ id: orders.id });
  if (!res.length) return false;
  await db.insert(orderEvents).values({ orderId, type: "cancelled", note, actor });
  await releaseOrderResources(orderId);
  return true;
}

/** إلغاء طلبات الدفع الإلكتروني التي لم يكتمل دفعها خلال ساعتين (لتحرير المخزون المحجوز) */
export async function cancelStaleUnpaidOrders() {
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const stale = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.paymentMethod, "edfapay"),
        inArray(orders.paymentStatus, ["unpaid", "failed"]),
        eq(orders.status, "pending"),
        lt(orders.createdAt, cutoff),
      ),
    )
    .limit(50);
  for (const o of stale) await cancelOrder(o.id, "أُلغي تلقائيًا لعدم إتمام الدفع");
  return stale.length;
}

/** تأكيد الدفع — آمن للتكرار (webhook قد يصل أكثر من مرة) */
export async function markOrderPaid(orderId: number, transactionId: string | null, raw: unknown) {
  const res = await db
    .update(orders)
    .set({
      paymentStatus: "paid",
      status: dsql`case when ${orders.status} = 'pending' then 'processing' else ${orders.status} end`,
      gatewayTransactionId: transactionId,
      paidAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(orders.id, orderId), dsql`${orders.paymentStatus} <> 'paid'`, dsql`${orders.status} <> 'cancelled'`))
    .returning({ id: orders.id, total: orders.total });
  if (!res.length) return false;
  await db.insert(orderEvents).values({ orderId, type: "paid", note: "تم تأكيد الدفع — جارٍ تجهيز طلبك" });
  await db.insert(paymentAttempts).values({
    orderId,
    provider: "edfapay",
    providerRef: transactionId,
    status: "approved",
    amount: res[0].total,
    raw: raw as object,
  });
  return true;
}

export async function markPaymentFailed(orderId: number, transactionId: string | null, reason: string | null, raw: unknown) {
  const res = await db
    .update(orders)
    .set({ paymentStatus: "failed", updatedAt: new Date() })
    .where(and(eq(orders.id, orderId), eq(orders.paymentStatus, "unpaid")))
    .returning({ id: orders.id, total: orders.total });
  await db.insert(paymentAttempts).values({
    orderId,
    provider: "edfapay",
    providerRef: transactionId,
    status: "declined",
    amount: res[0]?.total ?? 0,
    raw: raw as object,
  });
  if (res.length) {
    await db.insert(orderEvents).values({
      orderId,
      type: "payment_failed",
      note: reason ? `لم تكتمل عملية الدفع: ${reason}` : "لم تكتمل عملية الدفع",
    });
  }
}

export async function getOrderByNumber(number: string) {
  return db.query.orders.findFirst({
    where: eq(orders.number, number.trim().toUpperCase()),
    with: { items: true, events: { orderBy: (e, { asc }) => [asc(e.createdAt), asc(e.id)] } },
  });
}

export type OrderWithDetails = NonNullable<Awaited<ReturnType<typeof getOrderByNumber>>>;
