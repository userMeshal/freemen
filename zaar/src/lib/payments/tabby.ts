import "server-only";

/**
 * تكامل تابي (اشترِ الآن وادفع لاحقًا) — Checkout API v2
 * المرجع: https://docs.tabby.ai/api-reference/checkout/create-a-session
 *
 * - إنشاء جلسة:  POST {base}/api/v2/checkout              (Bearer secret key)
 * - حالة الدفع:  GET  {base}/api/v2/payments/{id}
 * - تحصيل:       POST {base}/api/v2/payments/{id}/captures
 * - استرداد:     POST {base}/api/v2/payments/{id}/refunds
 *
 * ملاحظة: كُتب وفق التوثيق العلني ولم يُختبر مقابل حساب تابي حقيقي — جرّبه ببيئة الاختبار قبل التشغيل.
 */

function base(): string {
  return (process.env.TABBY_BASE_URL || "https://api.tabby.ai").replace(/\/$/, "");
}

function secret(): string {
  const k = process.env.TABBY_SECRET_KEY;
  if (!k) throw new Error("TABBY_SECRET_KEY غير مضبوط");
  return k;
}

export function tabbyConfigured(): boolean {
  return Boolean(process.env.TABBY_SECRET_KEY && process.env.TABBY_MERCHANT_CODE);
}

const sar = (halalas: number) => (halalas / 100).toFixed(2);

async function call<T>(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T | null }> {
  const res = await fetch(`${base()}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret()}`, ...(init?.headers ?? {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  return { ok: res.ok, status: res.status, data: (await res.json().catch(() => null)) as T | null };
}

export type TabbyStartInput = {
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
  urls: { success: string; cancel: string; failure: string };
};

export async function tabbyStart(input: TabbyStartInput): Promise<{ redirectUrl: string; paymentId: string }> {
  const { ok, status, data } = await call<{
    status?: string;
    payment?: { id?: string };
    configuration?: { available_products?: { installments?: { web_url?: string }[] } };
    rejection_reason_code?: string;
  }>("/api/v2/checkout", {
    method: "POST",
    body: JSON.stringify({
      payment: {
        amount: sar(input.total),
        currency: "SAR",
        description: `${input.storeName} — ${input.orderNumber}`,
        buyer: { name: input.customer.name, phone: input.customer.phone, email: input.customer.email || `${input.customer.phone}@customers.zaar.sa` },
        shipping_address: { city: input.address.city, address: input.address.address, zip: "00000" },
        order: {
          reference_id: input.ref,
          tax_amount: sar(input.vat),
          shipping_amount: sar(input.shipping),
          discount_amount: sar(input.discount),
          items: input.items.map((i) => ({
            reference_id: i.id,
            title: i.title,
            quantity: i.qty,
            unit_price: sar(i.unitPrice),
            category: "general",
          })),
        },
        buyer_history: { registered_since: new Date().toISOString(), loyalty_level: 0 },
        order_history: [],
        meta: { order_id: input.ref },
      },
      lang: "ar",
      merchant_code: process.env.TABBY_MERCHANT_CODE,
      merchant_urls: input.urls,
    }),
  });
  const url = data?.configuration?.available_products?.installments?.[0]?.web_url;
  const paymentId = data?.payment?.id;
  if (!ok || data?.status !== "created" || !url || !paymentId) {
    throw new Error(`Tabby checkout failed (${status}): ${data?.rejection_reason_code ?? data?.status ?? "no session"}`);
  }
  return { redirectUrl: url, paymentId };
}

export type TabbyPayment = { id: string; status: string; amount: string; order?: { reference_id?: string }; captures?: { amount: string }[] };

export async function tabbyGet(paymentId: string): Promise<TabbyPayment | null> {
  const { ok, data } = await call<TabbyPayment>(`/api/v2/payments/${encodeURIComponent(paymentId)}`);
  return ok ? data : null;
}

/** AUTHORIZED ← يجب تحصيله؛ CLOSED ← مُحصّل ومكتمل */
export async function tabbyCapture(paymentId: string, amount: number): Promise<boolean> {
  const { ok } = await call(`/api/v2/payments/${encodeURIComponent(paymentId)}/captures`, {
    method: "POST",
    body: JSON.stringify({ amount: sar(amount) }),
  });
  return ok;
}

export async function tabbyRefund(paymentId: string, amount: number, reason: string): Promise<boolean> {
  const { ok } = await call(`/api/v2/payments/${encodeURIComponent(paymentId)}/refunds`, {
    method: "POST",
    body: JSON.stringify({ amount: sar(amount), reason }),
  });
  return ok;
}
