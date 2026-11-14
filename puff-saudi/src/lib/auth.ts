import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { admins, customers } from "@/db/schema";
import { ADMIN_COOKIE, CUSTOMER_COOKIE, signSession, verifySession, type SessionKind } from "./session";

const ADMIN_MAX_AGE = 60 * 60 * 12; // 12 ساعة
const CUSTOMER_MAX_AGE = 60 * 60 * 24 * 30; // 30 يومًا

async function setCookie(kind: SessionKind, id: number, name: string) {
  const jar = await cookies();
  const maxAge = kind === "admin" ? ADMIN_MAX_AGE : CUSTOMER_MAX_AGE;
  const token = await signSession({ sub: String(id), kind, name }, maxAge);
  jar.set(kind === "admin" ? ADMIN_COOKIE : CUSTOMER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export const startAdminSession = (id: number, name: string) => setCookie("admin", id, name);
export const startCustomerSession = (id: number, name: string) => setCookie("customer", id, name);

export async function endSession(kind: SessionKind) {
  const jar = await cookies();
  jar.delete(kind === "admin" ? ADMIN_COOKIE : CUSTOMER_COOKIE);
}

export async function getAdmin() {
  const jar = await cookies();
  const session = await verifySession(jar.get(ADMIN_COOKIE)?.value, "admin");
  if (!session) return null;
  const rows = await db.select().from(admins).where(eq(admins.id, Number(session.sub))).limit(1);
  return rows[0] ?? null;
}

export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

export async function getCustomer() {
  const jar = await cookies();
  const session = await verifySession(jar.get(CUSTOMER_COOKIE)?.value, "customer");
  if (!session) return null;
  const rows = await db.select().from(customers).where(eq(customers.id, Number(session.sub))).limit(1);
  return rows[0] ?? null;
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
