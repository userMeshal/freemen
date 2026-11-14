"use server";

import { z } from "zod";
import { and, eq, sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import { orders, paymentAttempts } from "@/db/schema";
import { clientIp, getCustomer } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeSaudiPhone, normalizeShortAddress, toLatinDigits } from "@/lib/normalize";
import { CheckoutError, createOrder } from "@/lib/orders";
import { edfapayInitiate } from "@/lib/edfapay";
import { edfapayConfigured, siteUrl } from "@/lib/settings";

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
  paymentMethod: z.enum(["edfapay", "cod"]),
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
  if (!(await rateLimit(`checkout:${ip}`, 12, 600))) {
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
  if (data.paymentMethod === "edfapay" && !edfapayConfigured()) {
    return { ok: false, error: "الدفع الإلكتروني غير متاح حاليًا.", code: "payment" };
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
  if (data.paymentMethod === "cod") return { ok: true, redirect: `${orderUrl}&new=1`, external: false };

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
  if (!(await rateLimit(`pay-retry:${ip}`, 10, 600))) return { ok: false, error: "محاولات كثيرة. انتظر قليلًا." };
  const { number, token } = refSchema.parse(input);
  const order = await findOrder(number, token);
  if (!order) return { ok: false, error: "الطلب غير موجود." };
  if (order.paymentStatus === "paid") return { ok: true, redirect: `/order/${order.number}?t=${order.accessToken}`, external: false };
  if (order.status === "cancelled") return { ok: false, error: "هذا الطلب ملغي. أنشئ طلبًا جديدًا." };
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
  const order = await findOrder(number, token);
  if (!order) return { found: false as const };
  return { found: true as const, paymentStatus: order.paymentStatus, status: order.status };
}
