import type { ZodError } from "zod";
import { normalizeArabic, toLatinDigits } from "./normalize";

export type ActionState = { ok: boolean; message: string } | null;
export type AdminAction = (prev: ActionState, fd: FormData) => Promise<ActionState>;

export const ok = (message: string): ActionState => ({ ok: true, message });
export const fail = (message: string): ActionState => ({ ok: false, message });

export function firstError(error: ZodError): string {
  return error.issues[0]?.message ?? "البيانات المدخلة غير صحيحة";
}

export function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function bool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}

/** "146" أو "146.50" ← 14600 / 14650 ، والفارغ ← null ، وغير الصالح ← NaN */
export function sarToHalalas(input: string | null | undefined): number | null {
  const raw = toLatinDigits(String(input ?? "")).replace(/[,\s]/g, "");
  if (!raw) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return NaN;
  return Math.round(parseFloat(raw) * 100);
}

/** عدد صحيح غير سالب ، الفارغ ← null ، غير الصالح ← NaN */
export function intOrNull(input: string | null | undefined): number | null {
  const raw = toLatinDigits(String(input ?? "")).trim();
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) return NaN;
  return parseInt(raw, 10);
}

export function halalasToInput(v: number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const n = v / 100;
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export function pageNumber(value: string | string[] | undefined): number {
  const n = parseInt(Array.isArray(value) ? value[0] : (value ?? "1"), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

const dateTimeFmt = new Intl.DateTimeFormat("ar-SA-u-nu-latn-ca-gregory", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Riyadh",
});
const dateFmt = new Intl.DateTimeFormat("ar-SA-u-nu-latn-ca-gregory", {
  dateStyle: "medium",
  timeZone: "Asia/Riyadh",
});

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return dateTimeFmt.format(typeof d === "string" ? new Date(d) : d);
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return dateFmt.format(typeof d === "string" ? new Date(d) : d);
}

/** قيمة datetime-local (بتوقيت الرياض) ← Date */
export function riyadhLocalToDate(input: string): Date | null {
  if (!input) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(input)) return null;
  const d = new Date(`${input.slice(0, 16)}:00+03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date ← قيمة datetime-local بتوقيت الرياض */
export function dateToRiyadhLocal(d: Date | null | undefined): string {
  if (!d) return "";
  const shifted = new Date(d.getTime() + 3 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 16);
}

export const FAMILY_OPTIONS: { value: string; label: string }[] = [
  { value: "sippy", label: "بف سيبي" },
  { value: "coffee", label: "بف كوفي" },
  { value: "flippy-steel", label: "بف فليبي ستانلس" },
  { value: "flippy-tritan", label: "بف فليبي تريتان" },
  { value: "special", label: "إصدار خاص" },
  { value: "accessories", label: "إكسسوارات" },
  { value: "other", label: "أخرى" },
];

export function familyLabel(value: string): string {
  return FAMILY_OPTIONS.find((f) => f.value === value)?.label ?? value;
}

const FAMILY_WORDS: Record<string, string> = {
  sippy: "sippy سيبي",
  coffee: "coffee كوفي قهوه",
  "flippy-steel": "flippy فليبي ستانلس steel اطفال",
  "flippy-tritan": "flippy فليبي تريتان tritan اطفال",
  special: "special اصدار خاص",
  accessories: "ماصات اكسسوارات straws",
};

/** نفس وصفة scripts/seed.ts */
export function buildSearchText(p: {
  name: string;
  colorName: string | null;
  capacityMl: number | null;
  family: string;
  variants: { optionValue: string | null; sku: string }[];
}): string {
  return normalizeArabic(
    [
      p.name,
      p.colorName ?? "",
      p.capacityMl ? `${p.capacityMl} مل ml` : "",
      FAMILY_WORDS[p.family] ?? "",
      p.variants.map((v) => v.optionValue ?? "").join(" "),
      p.variants.map((v) => v.sku).join(" "),
    ].join(" "),
  );
}

/** الروابط المسموحة لصور المنتجات: مسار محلي أو Vercel Blob (المسموح في next/image و CSP) */
export function isAllowedImageUrl(url: string): boolean {
  if (/^\/(media|uploads)\/[\w\-./%]+$/.test(url)) return true;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export const ORDER_STATUS_TONE: Record<string, "neutral" | "amber" | "blue" | "green" | "red"> = {
  pending: "amber",
  processing: "blue",
  shipped: "blue",
  delivered: "green",
  cancelled: "red",
};

export const PAYMENT_STATUS_TONE: Record<string, "neutral" | "amber" | "blue" | "green" | "red"> = {
  unpaid: "amber",
  paid: "green",
  failed: "red",
  refunded: "neutral",
};

/** شرط الإيراد المعتمد في التقارير: طلب غير ملغي، مدفوع أو دفع عند الاستلام غير مُسترد */
export const REVENUE_SQL = `status <> 'cancelled' and (payment_status = 'paid' or (payment_method = 'cod' and payment_status <> 'refunded'))`;
