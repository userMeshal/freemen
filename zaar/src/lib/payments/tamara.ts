import "server-only";
import { jwtVerify } from "jose";

/**
 * تكامل تمارا (قسّمها على دفعات) — Online Checkout API
 * المرجع: https://docs.tamara.co/reference/createcheckoutsession
 *
 * - إنشاء جلسة:  POST {base}/checkout                       (Bearer API token)
 * - اعتماد:      POST {base}/orders/{order_id}/authorise
 * - تحصيل:       POST {base}/payments/capture
 * - استرداد:     POST {base}/payments/simplified-refund/{order_id}
 * - الإشعارات:   تصل مع tamaraToken (JWT موقّع بـ notification token)
 *
 * ملاحظة: كُتب وفق التوثيق العلني ولم يُختبر مقابل حساب تمارا حقيقي — جرّبه ببيئة الاختبار قبل التشغيل.
 */

function base(): string {
  if (process.env.TAMARA_BASE_URL) return process.env.TAMARA_BASE_URL.replace(/\/$/, "");
  return process.env.TAMARA_ENV === "production" ? "https://api.tamara.co" : "https://api-sandbox.tamara.co";
}

function token(): string {
  const k = process.env.TAMARA_API_TOKEN;
  if (!k) throw new Error("TAMARA_API_TOKEN غير مضبوط");
  return k;
}

export function tamaraConfigured(): boolean {
  return Boolean(process.env.TAMARA_API_TOKEN);
}

const money = (halalas: number) => ({ amount: Number((halalas / 100).toFixed(2)), currency: "SAR" });

async function call<T>(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T | null }> {
  const res = await fetch(`${base()}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}`, ...(init?.headers ?? {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  return { ok: res.ok, status: res.status, data: (await res.json().catch(() => null)) as T | null };
}

export type TamaraStartInput = {
  ref: string;
  orderNumber: string;
  total: number;
  shipping: number;
  discount: number;
  vat: number;
  storeName: string;
  customer: { name: string; phone: string; email: string };
  address: { city: string; address: string };
  items: { id: string; title: string; qty: number; unitPrice: number }[];
  urls: { success: string; cancel: string; failure: string; notification: string };
};

export async function tamaraStart(input: TamaraStartInput): Promise<{ redirectUrl: string; orderId: string }> {
  const [first, ...rest] = input.customer.name.trim().split(/\s+/);
  const last = rest.join(" ") || first;
  const { ok, status, data } = await call<{ order_id?: string; checkout_url?: string; message?: string }>("/checkout", {
    method: "POST",
    body: JSON.stringify({
      order_reference_id: input.ref,
      order_number: input.orderNumber,
      total_amount: money(input.total),
      shipping_amount: money(input.shipping),
      tax_amount: money(input.vat),
      discount: { name: "discount", amount: money(input.discount) },
      description: `${input.storeName} — ${input.orderNumber}`,
      country_code: "SA",
      payment_type: "PAY_BY_INSTALMENTS",
      instalments: 3,
      locale: "ar_SA",
      items: input.items.map((i) => ({
        reference_id: i.id,
        type: "physical",
        name: i.title,
        sku: i.id,
        quantity: i.qty,
        unit_price: money(i.unitPrice),
        total_amount: money(i.unitPrice * i.qty),
      })),
      consumer: { first_name: first, last_name: last, phone_number: input.customer.phone, email: input.customer.email || `${input.customer.phone}@customers.zaar.sa` },
      shipping_address: { first_name: first, last_name: last, line1: input.address.address, city: input.address.city, country_code: "SA", phone_number: input.customer.phone },
      merchant_url: input.urls,
      platform: "Zaar",
    }),
  });
  if (!ok || !data?.checkout_url || !data.order_id) {
    throw new Error(`Tamara checkout failed (${status}): ${data?.message ?? "no checkout_url"}`);
  }
  return { redirectUrl: data.checkout_url, orderId: data.order_id };
}

export type TamaraOrder = { order_id: string; status: string; order_reference_id?: string; total_amount?: { amount: number } };

export async function tamaraGet(orderId: string): Promise<TamaraOrder | null> {
  const { ok, data } = await call<TamaraOrder>(`/orders/${encodeURIComponent(orderId)}`);
  return ok ? data : null;
}

/** approved ← يجب اعتماده (authorise) ثم تحصيله */
export async function tamaraAuthorise(orderId: string): Promise<boolean> {
  const { ok } = await call(`/orders/${encodeURIComponent(orderId)}/authorise`, { method: "POST" });
  return ok;
}

export async function tamaraCapture(orderId: string, total: number, shipping: number, vat: number): Promise<boolean> {
  const { ok } = await call(`/payments/capture`, {
    method: "POST",
    body: JSON.stringify({ order_id: orderId, total_amount: money(total), shipping_amount: money(shipping), tax_amount: money(vat), shipping_info: { shipped_at: new Date().toISOString(), shipping_company: "N/A" } }),
  });
  return ok;
}

export async function tamaraRefund(orderId: string, amount: number, comment: string): Promise<boolean> {
  const { ok } = await call(`/payments/simplified-refund/${encodeURIComponent(orderId)}`, {
    method: "POST",
    body: JSON.stringify({ total_amount: money(amount), comment }),
  });
  return ok;
}

/** يتحقق من توقيع إشعار تمارا (tamaraToken) */
export async function tamaraVerifyNotification(jwt: string | null): Promise<boolean> {
  const secret = process.env.TAMARA_NOTIFICATION_TOKEN;
  if (!secret || !jwt) return false;
  try {
    await jwtVerify(jwt.replace(/^Bearer\s+/i, ""), new TextEncoder().encode(secret), { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}
