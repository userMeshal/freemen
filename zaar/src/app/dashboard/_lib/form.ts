import { z } from "zod";
import type { ActionState } from "@/components/dash/client";
import { latinDigits, normalizePhone, toHalalas } from "@/lib/money";

/** أدوات مشتركة لإجراءات لوحة التاجر: تنظيف المدخلات وتحويل المبالغ */

export const NO_SESSION: ActionState = { ok: false, error: "سجّل دخولك من جديد" };
export const fail = (error: string): ActionState => ({ ok: false, error });
export const done = (message: string): ActionState => ({ ok: true, message });
export const zodFail = (error: z.ZodError): ActionState => fail(error.issues[0]?.message ?? "تأكد من البيانات المدخلة");

export function text(form: FormData, key: string, max: number): string {
  const v = form.get(key);
  return typeof v === "string" ? v.replace(/\u0000/g, "").trim().slice(0, max) : "";
}

export function idOf(form: FormData, key = "id"): number | null {
  const n = Number(text(form, key, 12));
  return Number.isInteger(n) && n > 0 ? n : null;
}

const MAX_SAR = 99_999_900;

/** مبلغ بالريال كما كتبه التاجر (يقبل الأرقام العربية) → هللات، أو null إن لم يكن مبلغًا صالحًا */
export function sar(raw: string): number | null {
  const s = latinDigits(raw).replace(/[\s,٬]/g, "").replace("٫", ".");
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(s)) return null;
  const h = toHalalas(s);
  return h <= MAX_SAR ? h : null;
}

export const zSar = (label: string, min = 0) =>
  z.string().transform((v, ctx) => {
    const h = sar(v);
    if (h === null || h < min) {
      ctx.addIssue(`${label}: اكتب مبلغًا صحيحًا بالريال`);
      return z.NEVER;
    }
    return h;
  });

/** مثل zSar لكن الحقل الفارغ يرجع null */
export const zSarOptional = (label: string, min = 0) =>
  z.string().transform((v, ctx) => {
    if (v === "") return null;
    const h = sar(v);
    if (h === null || h < min) {
      ctx.addIssue(`${label}: اكتب مبلغًا صحيحًا بالريال أو اتركه فاضي`);
      return z.NEVER;
    }
    return h;
  });

/** عدد صحيح اختياري ضمن حدود؛ الفارغ يرجع null */
export const zIntOptional = (label: string, min: number, max: number) =>
  z.string().transform((v, ctx) => {
    if (v === "") return null;
    const s = latinDigits(v);
    const n = Number(s);
    if (!/^\d{1,9}$/.test(s) || n < min || n > max) {
      ctx.addIssue(`${label}: اكتب رقمًا صحيحًا بين ${min} و ${max}`);
      return z.NEVER;
    }
    return n;
  });

export function sarInput(halalas: number | null | undefined): string {
  return halalas === null || halalas === undefined ? "" : String(halalas / 100);
}

export function waLink(phone: string, message?: string): string | null {
  const p = normalizePhone(phone);
  if (!p) return null;
  return `https://wa.me/966${p.slice(1)}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

export function likeTerm(q: string): string {
  return `%${q.replace(/[\\%_]/g, "\\$&")}%`;
}

export function pageOf(raw: string | string[] | undefined): number {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(n) && n > 0 && n < 100000 ? n : 1;
}

export function one(raw: string | string[] | undefined, max = 60): string {
  return ((Array.isArray(raw) ? raw[0] : raw) ?? "").trim().slice(0, max);
}

export const PAYMENT_LABEL: Record<string, string> = {
  card: "بطاقة",
  tabby: "تابي",
  tamara: "تمارا",
  cod: "عند الاستلام",
};

export const SHIPPING_COMPANIES = ["سمسا", "أرامكس", "البريد السعودي سبل", "ريدبوكس", "DHL", "أخرى"] as const;

/** صور المنتجات تُقبل فقط من مخزن Vercel Blob وتحت مجلد المتجر نفسه */
export function isStoreImageUrl(url: string, storeId: number): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com") && u.pathname.startsWith(`/stores/${storeId}/`) && url.length <= 500;
  } catch {
    return false;
  }
}
