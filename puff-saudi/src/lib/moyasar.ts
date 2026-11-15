import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * تكامل ميسر (Moyasar) — نموذج الدفع داخل الموقع مع Payment Intents.
 * المرجع: https://docs.moyasar.com
 *
 * 1) الخادم ينشئ Payment Intent بالمبلغ والوصف (مقفلان، لا يستطيع المتصفح تغييرهما).
 * 2) نموذج ميسر في المتصفح يُتمّ الدفع بالمفتاح العام + client_secret.
 * 3) ميسر يعيد العميل إلى callback_url ومعه ?id=<payment_id>، فنجلب العملية بالمفتاح السري
 *    ونطابق الحالة والمبلغ والوصف قبل اعتماد الطلب. الـ webhook احتياط لمن أغلق المتصفح.
 *
 * المفتاح السري لا يخرج من الخادم أبدًا.
 */

const BASE = () => (process.env.MOYASAR_BASE_URL || "https://api.moyasar.com/v1").replace(/\/$/, "");

export function moyasarPublishableKey(): string {
  return (process.env.MOYASAR_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY || "").trim();
}

function secretKey(): string {
  const key = (process.env.MOYASAR_SECRET_KEY || "").trim();
  if (!key) throw new Error("MOYASAR_SECRET_KEY غير مضبوط");
  return key;
}

export function moyasarConfigured(): boolean {
  return Boolean((process.env.MOYASAR_SECRET_KEY || "").trim() && moyasarPublishableKey());
}

/** هل المفاتيح مفاتيح اختبار؟ (للعرض في لوحة التحكم فقط) */
export function moyasarMode(): "live" | "test" | "unknown" {
  const pk = moyasarPublishableKey();
  if (pk.startsWith("pk_live_")) return "live";
  if (pk.startsWith("pk_test_")) return "test";
  return "unknown";
}

async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${BASE()}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Basic ${Buffer.from(`${secretKey()}:`).toString("base64")}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await res.json().catch(() => null)) as (T & { message?: string; type?: string }) | null;
  if (!res.ok || !json) {
    throw new Error(`Moyasar ${init.method ?? "GET"} ${path} failed (${res.status}): ${json?.message ?? json?.type ?? "no body"}`);
  }
  return json;
}

/** الوصف المقفل على العملية — نربط به العملية بالطلب عند التحقق */
export const moyasarDescription = (orderNumber: string) => `PUFF SAUDI ${orderNumber}`;
export function orderNumberFromDescription(description: string | null | undefined): string | null {
  const m = /\b(PF\d{4,})\b/.exec(description ?? "");
  return m ? m[1] : null;
}

export type MoyasarIntent = { id: string; client_secret: string; status: string; amount: number; expires_at?: string };

export function createPaymentIntent(input: { amountHalalas: number; orderNumber: string; callbackUrl: string }) {
  return api<MoyasarIntent>("/payment_intents", {
    method: "POST",
    body: {
      amount: input.amountHalalas,
      currency: "SAR",
      description: moyasarDescription(input.orderNumber),
      callback_url: input.callbackUrl,
    },
  });
}

export type MoyasarPayment = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  description: string | null;
  refunded?: number;
  source?: { type?: string; company?: string; message?: string | null; transaction_url?: string | null };
};

export function fetchPayment(id: string) {
  return api<MoyasarPayment>(`/payments/${encodeURIComponent(id)}`);
}

export const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** paid / captured = مدفوع ، failed = مرفوض ، غير ذلك = ما زال قيد المعالجة */
export function classifyMoyasarStatus(status: string | undefined): "approved" | "declined" | "pending" {
  const s = (status ?? "").toLowerCase();
  if (s === "paid" || s === "captured") return "approved";
  if (s === "failed" || s === "voided" || s === "canceled") return "declined";
  return "pending";
}

/* ───────── Webhooks ───────── */

/** سر الـ webhook: من MOYASAR_WEBHOOK_SECRET إن وُجد، وإلا يُشتق من AUTH_SECRET (فلا يحتاج التاجر لضبط شيء) */
export function moyasarWebhookSecret(): string {
  const explicit = (process.env.MOYASAR_WEBHOOK_SECRET || "").trim();
  if (explicit) return explicit;
  return createHmac("sha256", process.env.AUTH_SECRET || "").update("moyasar-webhook-v1").digest("hex").slice(0, 40);
}

export function webhookSecretMatches(token: unknown): boolean {
  if (typeof token !== "string" || !token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(moyasarWebhookSecret());
  return a.length === b.length && timingSafeEqual(a, b);
}

export type MoyasarWebhook = { id: string; url: string; http_method: string; events?: string[]; verified?: boolean };

export async function listWebhooks(): Promise<MoyasarWebhook[]> {
  const res = await api<{ webhooks?: MoyasarWebhook[] } | MoyasarWebhook[]>("/webhooks");
  return Array.isArray(res) ? res : (res.webhooks ?? []);
}

export function createWebhook(url: string) {
  return api<MoyasarWebhook>("/webhooks", {
    method: "POST",
    body: { http_method: "post", url, shared_secret: moyasarWebhookSecret(), events: ["payment_paid", "payment_failed"] },
  });
}

export function verifyWebhook(id: string, code: string) {
  return api<MoyasarWebhook>(`/webhooks/${encodeURIComponent(id)}/verify`, { method: "POST", body: { code } });
}

export function resendWebhookVerification(id: string) {
  return api<unknown>(`/webhooks/${encodeURIComponent(id)}/resend_verification`, { method: "POST" });
}
