import "server-only";
import { unstable_cache } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";

export type StoreSettings = {
  storeName: string;
  tagline: string;
  email: string;
  phone: string;
  whatsapp: string;
  instagram: string;
  tiktok: string;
  snapchat: string;
  x: string;
  crNumber: string;
  vatNumber: string;
  /** نسبة الضريبة المضمّنة في الأسعار */
  vatRate: number;
  announcement: string;
  metaPixelId: string;
  tiktokPixelId: string;
  edfapayEnabled: boolean;
  moyasarEnabled: boolean;
  /** Apple Pay عبر ميسر — يتطلب تسجيل الدومين في لوحة ميسر */
  moyasarApplePay: boolean;
  moyasarStcPay: boolean;
  /** محتوى ملف التحقق من دومين Apple Pay (يُنزَّل من لوحة ميسر) */
  applePayDomainFile: string;
  codEnabled: boolean;
  /** رسوم الدفع عند الاستلام بالهللة */
  codFee: number;
};

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: "PUFF SAUDI",
  tagline: "أكواب بف — لونك، مزاجك، مشروبك",
  email: "",
  phone: "",
  whatsapp: "",
  instagram: "",
  tiktok: "",
  snapchat: "",
  x: "",
  crNumber: "",
  vatNumber: "",
  vatRate: 15,
  announcement: "",
  metaPixelId: "",
  tiktokPixelId: "",
  edfapayEnabled: true,
  moyasarEnabled: true,
  moyasarApplePay: false,
  moyasarStcPay: false,
  applePayDomainFile: "",
  codEnabled: false,
  codFee: 0,
};

async function readSettings(): Promise<StoreSettings> {
  const rows = await db.select().from(settings).where(eq(settings.key, "store")).limit(1);
  const value = (rows[0]?.value ?? {}) as Partial<StoreSettings>;
  return { ...DEFAULT_SETTINGS, ...value };
}

export const getSettings = unstable_cache(readSettings, ["store-settings"], {
  tags: ["settings"],
  revalidate: 3600,
});

export async function saveSettings(patch: Partial<StoreSettings>) {
  const current = await readSettings();
  const next = { ...current, ...patch };
  await db
    .insert(settings)
    .values({ key: "store", value: next })
    .onConflictDoUpdate({ target: settings.key, set: { value: next } });
  return next;
}

export function moyasarKeysPresent(): boolean {
  return Boolean(
    (process.env.MOYASAR_SECRET_KEY || "").trim() &&
      (process.env.MOYASAR_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY || "").trim(),
  );
}

/** بوابة الدفع الإلكتروني الفعّالة: ميسر أولًا إن كانت مفاتيحها مضبوطة ومفعّلة، ثم EdfaPay */
export function onlineProvider(s: Pick<StoreSettings, "moyasarEnabled" | "edfapayEnabled">): "moyasar" | "edfapay" | null {
  if (s.moyasarEnabled && moyasarKeysPresent()) return "moyasar";
  if (s.edfapayEnabled && edfapayConfigured()) return "edfapay";
  return null;
}

export function edfapayConfigured(): boolean {
  return Boolean(process.env.EDFAPAY_API_KEY);
}

export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
