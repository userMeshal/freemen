"use server";

import { queueOrderNotification } from "@/lib/notify";
import { z } from "zod";
import { and, eq, sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import { orders, paymentAttempts } from "@/db/schema";
import { clientIp, getCustomer } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeSaudiPhone, normalizeShortAddress, toLatinDigits } from "@/lib/normalize";
import { CheckoutError, createOrder } from "@/lib/orders";
import { edfapayInitiate } from "@/lib/edfapay";
import { createPaymentIntent, isUuid } from "@/lib/moyasar";
import { confirmMoyasarPayment, latestMoyasarPaymentId } from "@/lib/moyasar-orders";
import { edfapayConfigured, getSettings, moyasarKeysPresent, onlineProvider, siteUrl } from "@/lib/settings";

const text = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .transform((v) => v.replace(/[<>]/g, ""));

const checkoutSchema = z.object({
  items: z.array(z.object({ variantId: z.number().int().positive(), qty: z.number().int().min(1).max(20) })).min(1).max(60),
  expectedTotal: z.number().int().nonnegative(),
  couponCode: z.string().trim().max(40).nullish(),
  shippingMethodId: z.number().int().positive(),
  paymentMethod: z.enum(["moyasar", "edfapay", "cod"]),
  name: text(3, 80),
  phone: z.string().trim().max(30),
  email: z.string().trim().toLowerCase().max(120).pipe(z.email()),
  city: text(2, 60),
  shortAddress: z.string().trim().max(20),
  street: z
    .string()
    .trim()
    .max(200)
    .transform((v) => v.replace(/[<>]/g, ""))
    .optional(),
  note: z.string().trim().max(500).optional(),
});

export type CheckoutInput = z.input<typeof checkoutSchema>;
export type CheckoutResult =
  | { ok: true; redirect: string; external: boolean }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string> };

const FIELD_LABELS: Record<string, string> = {
  name: "اكتب الاسم الكامل",
  email: "بريد إلكتروني غير صحيح",
  city: "اكتب اسم المدينة",
};

async function startPayment(order: {
  id: number;
  number: string;
  accessToken: string;
  total: number;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  address: { city: string; shortAddress?: string; district?: string; street?: string };
}): Promise<string> {
  const attempts = await db
    .select({ c: dsql<number>`count(*)::int` })
    .from(paymentAttempts)
    .where(eq(paymentAttempts.orderId, order.id));
  const ref = `${order.number}-${attempts[0].c + 1}`;
  const back = `${siteUrl()}/checkout/return?o=${order.number}&t=${order.accessToken}`;
  const { redirectUrl, raw } = await edfapayInitiate({
    orderRef: ref,
    amountHalalas: order.total,
    customer: {
      name: order.customerName,
      email: order.customerEmail ?? "",
      phone: `+${order.customerPhone}`,
    },
    address: {
      city: order.address.city,
      address: [order.address.shortAddress, order.address.district, order.address.street].filter(Boolean).join("، ") || order.address.city,
    },
    successUrl: back,
    failureUrl: `${back}&s=failed`,
  });
  await db.insert(paymentAttempts).values({
    orderId: order.id,
    provider: "edfapay",
    providerRef: ref,
    status: "initiated",
    amount: order.total,
    raw: raw as object,
  });
  return redirectUrl;
}

export async function placeOrderAction(input: CheckoutInput): Promise<CheckoutResult> {
  const ip = await clientIp();
  // شبكات الجوال تشارك عنوان IP واحدًا بين عملاء كثيرين (CGNAT)، فحدّ الـ IP واسع ويعمل كصمّام أمان فقط؛
  // الحماية الفعلية من التكرار المزعج تكون لكل رقم جوال (أدناه).
  if (!(await rateLimit(`checkout:${ip}`, 200, 600))) {
    return { ok: false, error: "محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة." };
  }

  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      if (FIELD_LABELS[key] && !fieldErrors[key]) fieldErrors[key] = FIELD_LABELS[key];
    }
    return { ok: false, error: "راجع البيانات المظللة ثم أعد المحاولة.", fieldErrors };
  }
  const data = parsed.data;
  const phone = normalizeSaudiPhone(toLatinDigits(data.phone));
  const shortAddress = normalizeShortAddress(data.shortAddress);
  if (!phone || !shortAddress) {
    return {
      ok: false,
      error: "راجع البيانات المظللة ثم أعد المحاولة.",
      fieldErrors: {
        ...(phone ? {} : { phone: "رقم جوال سعودي غير صحيح (مثال: 05XXXXXXXX)" }),
        ...(shortAddress ? {} : { shortAddress: "العنوان المختصر 4 أحرف إنجليزية ثم 4 أرقام (مثال: RRRD2929)" }),
      },
    };
  }
  if (data.paymentMethod !== "cod" && onlineProvider(await getSettings()) !== data.paymentMethod) {
    return { ok: false, error: "الدفع الإلكتروني غير متاح حاليًا. حدّث الصفحة ثم أعد المحاولة.", code: "payment" };
  }

  if (!(await rateLimit(`checkout-phone:${phone}`, 8, 600))) {
    return { ok: false, error: "محاولات كثيرة بهذا الرقم. انتظر بضع دقائق ثم أعد المحاولة." };
  }

  const customer = await getCustomer();
  let order;
  try {
    order = await createOrder({
      items: data.items,
      expectedTotal: data.expectedTotal,
      couponCode: data.couponCode || null,
      shippingMethodId: data.shippingMethodId,
      paymentMethod: data.paymentMethod,
      customer: { name: data.name, phone, email: data.email },
      address: { city: data.city, shortAddress, ...(data.street ? { street: data.street } : {}) },
      note: data.note,
      loggedInCustomerId: customer?.id ?? null,
    });
  } catch (e) {
    if (e instanceof CheckoutError) return { ok: false, error: e.message, code: e.code };
    console.error("[checkout] createOrder failed", e);
    return { ok: false, error: "تعذّر إنشاء الطلب. حاول مرة أخرى." };
  }

  const orderUrl = `/order/${order.number}?t=${order.accessToken}`;
  if (data.paymentMethod === "cod") {
    // طلب الدفع عند الاستلام مؤكَّد لحظة إنشائه؛ الدفع الإلكتروني يُشعَر به عند تأكيد الدفع
    queueOrderNotification(order.id);
    return { ok: true, redirect: `${orderUrl}&new=1`, external: false };
  }
  // ميسر: الدفع يتم داخل الموقع في صفحة الدفع الخاصة بالطلب
  if (data.paymentMethod === "moyasar") {
    return { ok: true, redirect: `/checkout/pay/${order.number}?t=${order.accessToken}`, external: false };
  }

  try {
    const redirect = await startPayment({ ...order, address: order.address });
    return { ok: true, redirect, external: true };
  } catch (e) {
    console.error("[checkout] edfapay initiate failed", e);
    // الطلب محفوظ — نوجّه العميل لصفحته ليعيد محاولة الدفع
    return { ok: true, redirect: `${orderUrl}&pay=error`, external: false };
  }
}

const refSchema = z.object({ number: z.string().trim().max(20), token: z.string().trim().max(80) });

async function findOrder(number: string, token: string) {
  const rows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.number, number.toUpperCase()), eq(orders.accessToken, token)))
    .limit(1);
  return rows[0] ?? null;
}

export async function retryPaymentAction(input: { number: string; token: string }): Promise<CheckoutResult> {
  const ip = await clientIp();
  const { number, token } = refSchema.parse(input);
  // الحد لكل طلب (لا لكل IP) حتى لا يتأثر العملاء الذين يتشاركون عنوان الشبكة نفسه
  if (!(await rateLimit(`pay-retry:${ip}`, 200, 600)) || !(await rateLimit(`pay-retry-order:${number.toUpperCase()}`, 8, 600)))
    return { ok: false, error: "محاولات كثيرة. انتظر قليلًا." };
  const order = await findOrder(number, token);
  if (!order) return { ok: false, error: "الطلب غير موجود." };
  if (order.paymentStatus === "paid") return { ok: true, redirect: `/order/${order.number}?t=${order.accessToken}`, external: false };
  if (order.status === "cancelled") return { ok: false, error: "هذا الطلب ملغي. أنشئ طلبًا جديدًا." };
  if (order.paymentMethod === "moyasar" && moyasarKeysPresent()) {
    return { ok: true, redirect: `/checkout/pay/${order.number}?t=${order.accessToken}`, external: false };
  }
  if (order.paymentMethod !== "edfapay" || !edfapayConfigured()) return { ok: false, error: "الدفع الإلكتروني غير متاح لهذا الطلب." };
  try {
    return { ok: true, redirect: await startPayment(order), external: true };
  } catch (e) {
    console.error("[checkout] retry initiate failed", e);
    return { ok: false, error: "تعذّر الاتصال ببوابة الدفع. حاول بعد قليل." };
  }
}

export async function paymentStatusAction(input: { number: string; token: string }) {
  const { number, token } = refSchema.parse(input);
  let order = await findOrder(number, token);
  if (!order) return { found: false as const };
  // ميسر: لو سجّل المتصفح عملية لهذا الطلب نتحقق منها مباشرة بدل انتظار الـ webhook
  if (order.paymentMethod === "moyasar" && order.paymentStatus !== "paid" && order.status !== "cancelled" && moyasarKeysPresent()) {
    const paymentId = await latestMoyasarPaymentId(order.id);
    if (paymentId) {
      await confirmMoyasarPayment(order, paymentId).catch((e) => console.error("[moyasar] status check failed", e));
      order = (await findOrder(number, token)) ?? order;
    }
  }
  return { found: true as const, paymentStatus: order.paymentStatus, status: order.status };
}

/* ───────── ميسر ───────── */

export type MoyasarIntentResult = { ok: true; id: string; clientSecret: string } | { ok: false; error: string };

/** ينشئ Payment Intent بمبلغ الطلب كما هو في قاعدة البيانات — يُستدعى لحظة ضغط العميل زر الدفع */
export async function createMoyasarIntentAction(input: { number: string; token: string }): Promise<MoyasarIntentResult> {
  const { number, token } = refSchema.parse(input);
  if (!(await rateLimit(`moyasar-intent:${number.toUpperCase()}`, 12, 600))) return { ok: false, error: "محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة." };
  const order = await findOrder(number, token);
  if (!order || order.paymentMethod !== "moyasar") return { ok: false, error: "الطلب غير موجود." };
  if (order.paymentStatus === "paid") return { ok: false, error: "هذا الطلب مدفوع مسبقًا." };
  if (order.status === "cancelled") return { ok: false, error: "هذا الطلب ملغي. أنشئ طلبًا جديدًا." };
  if (!moyasarKeysPresent()) return { ok: false, error: "الدفع الإلكتروني غير متاح حاليًا." };
  try {
    const intent = await createPaymentIntent({
      amountHalalas: order.total,
      orderNumber: order.number,
      callbackUrl: `${siteUrl()}/checkout/return?o=${order.number}&t=${order.accessToken}`,
    });
    await db.insert(paymentAttempts).values({
      orderId: order.id,
      provider: "moyasar",
      providerRef: intent.id,
      status: "initiated",
      amount: order.total,
      raw: { intentId: intent.id, expiresAt: intent.expires_at ?? null },
    });
    return { ok: true, id: intent.id, clientSecret: intent.client_secret };
  } catch (e) {
    console.error("[moyasar] create intent failed", e);
    return { ok: false, error: "تعذّر الاتصال ببوابة الدفع. حاول بعد قليل أو اختر وسيلة دفع أخرى." };
  }
}

/** يحفظ رقم العملية قبل التحويل للتحقق البنكي (3DS) حتى نستطيع التحقق منها لو انقطع اتصال العميل */
export async function recordMoyasarPaymentAction(input: { number: string; token: string; paymentId: string }) {
  const { number, token } = refSchema.parse(input);
  if (!isUuid(input.paymentId)) return { ok: false as const };
  if (!(await rateLimit(`moyasar-record:${number.toUpperCase()}`, 20, 600))) return { ok: false as const };
  const order = await findOrder(number, token);
  if (!order || order.paymentMethod !== "moyasar") return { ok: false as const };
  await db.insert(paymentAttempts).values({
    orderId: order.id,
    provider: "moyasar",
    providerRef: input.paymentId,
    status: "created",
    amount: order.total,
  });
  return { ok: true as const };
}
