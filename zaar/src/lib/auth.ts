import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { merchants, stores } from "@/db/schema";
import { HQ_COOKIE, MERCHANT_COOKIE, signSession, verifySession, type SessionKind } from "./session";

const MERCHANT_MAX_AGE = 60 * 60 * 24 * 30;
const HQ_MAX_AGE = 60 * 60 * 12;

async function setCookie(kind: SessionKind, sub: string, name: string) {
  const jar = await cookies();
  const maxAge = kind === "hq" ? HQ_MAX_AGE : MERCHANT_MAX_AGE;
  const token = await signSession({ sub, kind, name }, maxAge);
  jar.set(kind === "hq" ? HQ_COOKIE : MERCHANT_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export const startMerchantSession = (id: number, name: string) => setCookie("merchant", String(id), name);
export const startHqSession = (email: string) => setCookie("hq", email, "HQ");

export async function endSession(kind: SessionKind) {
  const jar = await cookies();
  jar.delete(kind === "hq" ? HQ_COOKIE : MERCHANT_COOKIE);
}

export const getMerchant = cache(async () => {
  const jar = await cookies();
  const session = await verifySession(jar.get(MERCHANT_COOKIE)?.value, "merchant");
  if (!session) return null;
  const rows = await db.select().from(merchants).where(eq(merchants.id, Number(session.sub))).limit(1);
  return rows[0] ?? null;
});

/** التاجر الحالي ومتجره (أحدث متجر له). يحوّل لصفحة الدخول إن لم يكن مسجّلًا. */
export const requireMerchantStore = cache(async () => {
  const merchant = await getMerchant();
  if (!merchant) redirect("/login");
  const rows = await db.select().from(stores).where(eq(stores.merchantId, merchant.id)).orderBy(desc(stores.id)).limit(1);
  const store = rows[0];
  if (!store) redirect("/start");
  return { merchant, store };
});

/** للإجراءات: يرجع null بدل التحويل */
export async function merchantStore() {
  const merchant = await getMerchant();
  if (!merchant) return null;
  const rows = await db.select().from(stores).where(eq(stores.merchantId, merchant.id)).orderBy(desc(stores.id)).limit(1);
  return rows[0] ? { merchant, store: rows[0] } : null;
}

export async function ownsStore(merchantId: number, storeId: number): Promise<boolean> {
  const rows = await db
    .select({ id: stores.id })
    .from(stores)
    .where(and(eq(stores.id, storeId), eq(stores.merchantId, merchantId)))
    .limit(1);
  return rows.length > 0;
}

export async function getHq(): Promise<string | null> {
  const jar = await cookies();
  const session = await verifySession(jar.get(HQ_COOKIE)?.value, "hq");
  return session?.sub ?? null;
}

export async function requireHq(): Promise<string> {
  const hq = await getHq();
  if (!hq) redirect("/hq/login");
  return hq;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "0.0.0.0").trim();
}

/** حماية إضافية من CSRF للـ route handlers: يتأكد أن الطلب قادم من نفس الموقع */
export async function sameOrigin(): Promise<boolean> {
  const h = await headers();
  const origin = h.get("origin");
  const host = h.get("x-forwarded-host") || h.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
