import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * تكامل EdfaPay — Hosted Checkout (API v1)
 * المرجع: https://docs.edfapay.com/reference/initiate
 *
 * - Initiate:  POST {base}/payment-gateway/initiate   (X-API-KEY)
 * - Status:    GET  {base}/transactions/filterTransaction?id={transactionId}
 * - Webhook:   POST إلى /api/webhooks/edfapay مع ترويسة X-EdfaPay-Signature = HMAC-SHA256(secret, rawBody)
 *
 * وسائل الدفع (مدى / فيزا / ماستركارد / Apple Pay) تظهر في صفحة الدفع المستضافة لدى EdfaPay
 * بحسب ما هو مفعّل في حساب التاجر.
 */

const BASES = {
  production: "https://app-api.edfapay.com/api/v1",
  sandbox: "https://demo-api.edfapay.com/api/v1",
} as const;

function baseUrl(): string {
  if (process.env.EDFAPAY_BASE_URL) return process.env.EDFAPAY_BASE_URL.replace(/\/$/, "");
  return process.env.EDFAPAY_ENV === "production" ? BASES.production : BASES.sandbox;
}

function apiKey(): string {
  const key = process.env.EDFAPAY_API_KEY;
  if (!key) throw new Error("EDFAPAY_API_KEY غير مضبوط");
  return key;
}

export type InitiateInput = {
  /** مرجع فريد لكل محاولة دفع */
  orderRef: string;
  amountHalalas: number;
  customer: { name: string; email: string; phone: string };
  address: { city: string; address: string };
  successUrl: string;
  failureUrl: string;
};

export async function edfapayInitiate(input: InitiateInput): Promise<{ redirectUrl: string; raw: unknown }> {
  const res = await fetch(`${baseUrl()}/payment-gateway/initiate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", accept: "*/*", "X-API-KEY": apiKey() },
    body: JSON.stringify({
      orderId: input.orderRef,
      currency: "SAR",
      amount: Number((input.amountHalalas / 100).toFixed(2)),
      customerDetails: {
        name: input.customer.name,
        email: input.customer.email,
        phone: input.customer.phone,
      },
      address: {
        country: "SA",
        state: input.address.city,
        city: input.address.city,
        address: input.address.address,
      },
      recurringInit: "N",
      auth: "N",
      successUrl: input.successUrl,
      failureUrl: input.failureUrl,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const raw = (await res.json().catch(() => null)) as {
    code?: number;
    message?: string;
    data?: { redirectUrl?: string };
  } | null;
  const redirectUrl = raw?.data?.redirectUrl;
  if (!res.ok || !redirectUrl) {
    throw new Error(`EdfaPay initiate failed (${res.status}): ${raw?.message ?? "no redirectUrl"}`);
  }
  return { redirectUrl, raw };
}

export type EdfaTransaction = {
  transactionId: string;
  orderId: string;
  amount: string;
  transactionStatus?: string;
  paymentStatus?: string;
  transactionType?: string;
  declineReason?: string | null;
};

export async function edfapayStatus(transactionId: string): Promise<EdfaTransaction | null> {
  const res = await fetch(`${baseUrl()}/transactions/filterTransaction?id=${encodeURIComponent(transactionId)}`, {
    headers: { "X-API-KEY": apiKey() },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return null;
  const raw = (await res.json().catch(() => null)) as { data?: { content?: EdfaTransaction[] } } | null;
  return raw?.data?.content?.[0] ?? null;
}

export function verifyWebhookSignature(rawBody: string, signature: string | null): "valid" | "invalid" | "unsigned" {
  const secret = process.env.EDFAPAY_WEBHOOK_SECRET;
  if (!secret) return "unsigned";
  if (!signature) return "invalid";
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature.trim().toLowerCase(), "utf8");
  return a.length === b.length && timingSafeEqual(a, b) ? "valid" : "invalid";
}

export type WebhookPayload = {
  transactionId?: string;
  orderId?: string;
  amount?: number | string;
  status?: string;
  type?: string;
  cardScheme?: string;
  pgDetails?: { reason?: string | null };
};

export function classifyStatus(status: string | undefined): "approved" | "declined" | "pending" {
  const s = (status ?? "").toLowerCase();
  if (["approved", "success", "successful", "paid", "captured", "settled"].includes(s)) return "approved";
  if (["declined", "failed", "rejected", "cancelled", "canceled", "expired", "error"].includes(s)) return "declined";
  return "pending";
}
