import type { OrderStatus, Store } from "@/db/schema";
import type { Tone } from "@/components/dash/ui";

/** أدوات مشتركة بين صفحات إدارة زار (HQ) — دوال نقية بلا اتصال بقاعدة البيانات */

/** حالات الطلب التي تُحسب ضمن المبيعات (مدفوع ولم يُسترد) */
export const PAID_STATUSES: OrderStatus[] = ["paid", "processing", "shipped", "delivered"];

export const STORE_STATUS: Record<Store["status"], { label: string; tone: Tone }> = {
  live: { label: "منشور", tone: "good" },
  draft: { label: "مسودة", tone: "neutral" },
  suspended: { label: "موقوف", tone: "bad" },
};

export const THEME_LABEL: Record<string, string> = { bold: "جريء", soft: "ناعم" };

export const GATEWAY_LABEL: Record<string, string> = {
  edfapay: "EdfaPay",
  tabby: "تابي",
  tamara: "تمارا",
  test: "دفع تجريبي",
  cod: "الدفع عند الاستلام",
};

export const METHOD_LABEL: Record<string, string> = { card: "بطاقة", tabby: "تابي", tamara: "تمارا", cod: "عند الاستلام" };

export const LEDGER_LABEL: Record<string, string> = {
  sale: "بيع",
  fee: "عمولة زار",
  refund: "استرداد",
  fee_reversal: "إرجاع عمولة",
  payout_reversal: "عكس تحويل",
  adjustment: "تسوية",
};

export const PAYOUT_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "بانتظار التحويل", tone: "warn" },
  sent: { label: "تم التحويل", tone: "good" },
  failed: { label: "فشل", tone: "bad" },
};

/** نمط بحث ILIKE مع تعطيل رموز النمط في نص المستخدم */
export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** القيم المجمّعة قد ترجع نصًا (bigint) أو null */
export function toNum(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function pageOf(v: string | undefined): number {
  const n = Number.parseInt(v ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 100000) : 1;
}

/** يبني رابطًا بمعاملات البحث مع إسقاط الفارغ منها */
export function hrefWith(base: string, params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `${base}?${s}` : base;
}

/** أول قيمة لمعامل بحث (قد يتكرر في الرابط) */
export function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

/** آيبان مقسّم لمجموعات رباعية لتسهيل المطابقة البصرية */
export function prettyIban(iban: string): string {
  return iban.replace(/(.{4})/g, "$1 ").trim();
}
