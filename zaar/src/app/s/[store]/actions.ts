"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { abandonedCarts, orderItems, orders, reviews } from "@/db/schema";
import { clientIp } from "@/lib/auth";
import { openClaim } from "@/lib/claims";
import { normalizePhone } from "@/lib/money";
import { CheckoutError, createOrder, setPaymentAttempt } from "@/lib/orders";
import { gatewayFor, paymentOptions, startPayment } from "@/lib/payments";
import { settleOrder } from "@/lib/payments/settle";
import { quoteCart } from "@/lib/pricing";
import { rateLimit } from "@/lib/rate-limit";
import { bump } from "@/lib/stats";
import { getStoreBySlug } from "@/lib/stores";
import type { PaymentOption, Quote } from "@/lib/types";

const Lines = z
  .array(z.object({ productId: z.number().int().positive(), optionValue: z.string().max(40).nullable(), qty: z.number().int().min(1).max(20) }))
  .max(40);

async function liveStore(slug: string) {
  const store = await getStoreBySlug(slug);
  return store && store.status === "live" ? store : null;
}

export async function quoteAction(slug: string, lines: unknown, coupon: string | null): Promise<{ quote: Quote; payments: PaymentOption[]; live: boolean } | null> {
  const store = await getStoreBySlug(slug);
  const parsed = Lines.safeParse(lines);
  if (!store || !parsed.success) return null;
  return { quote: await quoteCart(store, parsed.data, coupon?.slice(0, 24) ?? null), payments: paymentOptions(), live: store.status === "live" };
}

/** السلة المتروكة: تُسجَّل عند كتابة رقم الجوال، وتُغلق تلقائيًا عند إتمام الطلب */
export async function saveCartAction(slug: string, input: { phone: string; name: string; lines: unknown }) {
  const store = await liveStore(slug);
  const phone = normalizePhone(input.phone ?? "");
  const parsed = Lines.safeParse(input.lines);
  if (!store || !phone || !parsed.success || !parsed.data.length) return;
  if (!(await rateLimit(`cart:${store.id}:${phone}`, 12, 3600))) return;
  const quote = await quoteCart(store, parsed.data, null);
  const items = quote.lines.filter((l) => l.available).map(({ lineTotal: _t, available: _a, ...l }) => l);
  if (!items.length) return;
  const name = String(input.name ?? "").trim().slice(0, 60);
  await db
    .insert(abandonedCarts)
    .values({ storeId: store.id, phone, name, items, total: quote.subtotal })
    .onConflictDoUpdate({ target: [abandonedCarts.storeId, abandonedCarts.phone], set: { name, items, total: quote.subtotal, recovered: false, updatedAt: new Date() } });
}

const Checkout = z.object({
  lines: Lines.min(1),
  couponCode: z.string().max(24).nullable(),
  method: z.enum(["card", "tabby", "tamara"]),
  name: z.string().trim().min(3, "اكتب اسمك الكامل").max(60),
  phone: z.string().trim().min(9).max(20),
  email: z.union([z.literal(""), z.string().trim().email("البريد الإلكتروني غير صحيح").max(120)]),
  city: z.string().trim().min(2, "اختر المدينة").max(40),
  address: z.string().trim().min(8, "اكتب عنوانك بالتفصيل (الحي، الشارع، رقم المبنى)").max(200),
  notes: z.string().trim().max(300),
});

export type PlaceOrderResult = { ok: true; redirectUrl: string } | { ok: false; error: string };

export async function placeOrderAction(slug: string, raw: unknown): Promise<PlaceOrderResult> {
  const store = await getStoreBySlug(slug);
  if (!store) return { ok: false, error: "المتجر غير موجود" };
  if (store.status !== "live") return { ok: false, error: "المتجر في وضع المعاينة — انشره أولًا حتى يستقبل الطلبات" };
  const parsed = Checkout.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "تحقق من البيانات" };
  const d = parsed.data;
  const phone = normalizePhone(d.phone);
  if (!phone) return { ok: false, error: "رقم الجوال غير صحيح — اكتبه بصيغة 05XXXXXXXX" };
  if (!gatewayFor(d.method)) return { ok: false, error: "وسيلة الدفع غير متاحة حاليًا" };
  if (!(await rateLimit(`checkout:${store.id}:${phone}`, 6, 600)) || !(await rateLimit(`checkout-ip:${await clientIp()}`, 30, 600))) {
    return { ok: false, error: "محاولات كثيرة — جرّب بعد دقائق" };
  }

  try {
    const { order, items } = await createOrder(store, {
      lines: d.lines,
      couponCode: d.couponCode,
      method: d.method,
      customer: { name: d.name, phone, email: d.email, city: d.city, address: d.address, notes: d.notes },
    });
    const ref = `${order.number}-1`;
    const pay = await startPayment(order, items, store, ref);
    await setPaymentAttempt(order.id, ref, pay.gateway, pay.gatewayPaymentId);
    await bump(store.id, "checkouts");
    return { ok: true, redirectUrl: pay.redirectUrl };
  } catch (e) {
    if (e instanceof CheckoutError) return { ok: false, error: e.message };
    console.error("[checkout]", e);
    return { ok: false, error: "تعذّر بدء عملية الدفع. جرّب مرة ثانية أو اختر وسيلة دفع أخرى." };
  }
}

async function findOrder(slug: string, number: string, token: string) {
  const store = await getStoreBySlug(slug);
  if (!store || !/^ZR\d{6,12}$/i.test(number) || !token || token.length > 60) return null;
  const rows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.storeId, store.id), eq(orders.number, number.toUpperCase())))
    .limit(1);
  const order = rows[0];
  return order && order.token === token ? { store, order } : null;
}

/** إعادة محاولة الدفع لطلب لم يكتمل دفعه */
export async function retryPaymentAction(slug: string, number: string, token: string, method: string): Promise<PlaceOrderResult> {
  const found = await findOrder(slug, number, token);
  const m = z.enum(["card", "tabby", "tamara"]).safeParse(method);
  if (!found || !m.success) return { ok: false, error: "الطلب غير موجود" };
  const { store, order } = found;
  if (order.status !== "pending_payment") return { ok: false, error: "هذا الطلب لا ينتظر دفعًا" };
  if (!gatewayFor(m.data)) return { ok: false, error: "وسيلة الدفع غير متاحة حاليًا" };
  if (!(await rateLimit(`retry:${order.id}`, 6, 600))) return { ok: false, error: "محاولات كثيرة — جرّب بعد دقائق" };
  try {
    const attempt = Number(order.paymentRef?.split("-")[1] ?? 1) + 1;
    const ref = `${order.number}-${attempt}`;
    await db.update(orders).set({ paymentMethod: m.data }).where(eq(orders.id, order.id));
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    const pay = await startPayment({ ...order, paymentMethod: m.data }, items, store, ref);
    await setPaymentAttempt(order.id, ref, pay.gateway, pay.gatewayPaymentId);
    return { ok: true, redirectUrl: pay.redirectUrl };
  } catch (e) {
    console.error("[retry-payment]", e);
    return { ok: false, error: "تعذّر بدء عملية الدفع. جرّب مرة ثانية." };
  }
}

/** صفحة الطلب تستعلم عن الدفع إن تأخر إشعار البوابة */
export async function refreshPaymentAction(slug: string, number: string, token: string): Promise<"paid" | "failed" | "pending"> {
  const found = await findOrder(slug, number, token);
  if (!found) return "failed";
  if (!(await rateLimit(`refresh:${found.order.id}`, 40, 600))) return "pending";
  return settleOrder(found.order);
}

export async function trackOrderAction(slug: string, number: string, phoneRaw: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const store = await getStoreBySlug(slug);
  const phone = normalizePhone(phoneRaw ?? "");
  const num = String(number ?? "").trim().toUpperCase().replace(/^#/, "");
  if (!store || !phone || !/^ZR\d{6,12}$/.test(num)) return { ok: false, error: "تأكد من رقم الطلب ورقم الجوال" };
  if (!(await rateLimit(`track:${store.id}:${phone}`, 8, 900)) || !(await rateLimit(`track-ip:${await clientIp()}`, 30, 900))) {
    return { ok: false, error: "محاولات كثيرة — جرّب بعد دقائق" };
  }
  const rows = await db
    .select({ number: orders.number, token: orders.token, phone: orders.customerPhone })
    .from(orders)
    .where(and(eq(orders.storeId, store.id), eq(orders.number, num)))
    .limit(1);
  if (!rows[0] || rows[0].phone !== phone) return { ok: false, error: "ما لقينا طلب بهذه البيانات" };
  return { ok: true, url: `/order/${rows[0].number}?t=${rows[0].token}` };
}

export async function openClaimAction(slug: string, number: string, token: string, reason: string, details: string): Promise<{ ok: boolean; error?: string }> {
  const found = await findOrder(slug, number, token);
  if (!found) return { ok: false, error: "الطلب غير موجود" };
  if (!(await rateLimit(`claim:${found.order.id}`, 5, 3600))) return { ok: false, error: "محاولات كثيرة — جرّب لاحقًا" };
  return openClaim(found.order, String(reason), String(details ?? "").trim());
}

export async function reviewAction(slug: string, number: string, token: string, productId: number, rating: number, body: string): Promise<{ ok: boolean; error?: string }> {
  const found = await findOrder(slug, number, token);
  if (!found) return { ok: false, error: "الطلب غير موجود" };
  const { order } = found;
  if (order.status !== "delivered") return { ok: false, error: "تقدر تقيّم بعد استلام الطلب" };
  const r = Math.round(Number(rating));
  if (!(r >= 1 && r <= 5)) return { ok: false, error: "اختر عدد النجوم" };
  const items = await db
    .select({ productId: orderItems.productId })
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));
  if (!items.some((i) => i.productId === productId)) return { ok: false, error: "المنتج ليس ضمن هذا الطلب" };
  const rows = await db
    .insert(reviews)
    .values({ storeId: order.storeId, productId, orderId: order.id, name: order.customerName.split(/\s+/)[0].slice(0, 30), rating: r, body: String(body ?? "").trim().slice(0, 600) })
    .onConflictDoNothing({ target: [reviews.orderId, reviews.productId] })
    .returning({ id: reviews.id });
  return rows.length ? { ok: true } : { ok: false, error: "سبق أن قيّمت هذا المنتج" };
}
