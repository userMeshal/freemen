import "server-only";
import { cache } from "react";
import { db } from "@/db";
import { platformSettings } from "@/db/schema";

/** إعدادات المنصة القابلة للتعديل من لوحة زار (HQ) */
export type PlatformConfig = {
  /** عمولة زار: نسبة بالنقاط الأساسية (250 = 2.5%) + مبلغ ثابت بالهللة لكل طلب */
  feeBp: number;
  feeFixed: number;
  /** مدة ضمان زار بالأيام بعد توصيل الطلب (والضمان مفتوح من لحظة الدفع حتى التوصيل) */
  guaranteeDays: number;
  /** مهلة رد التاجر على طلب الاسترداد بالساعات قبل أن تحسمه زار */
  claimReplyHours: number;
  /** أيام حجز المبلغ قبل دخوله في التحويل اليومي (0 = يُحوَّل في اليوم التالي) */
  payoutHoldDays: number;
  /** أقل مبلغ للتحويل بالهللة */
  payoutMin: number;
};

export const DEFAULT_PLATFORM: PlatformConfig = {
  feeBp: 250,
  feeFixed: 100,
  guaranteeDays: 14,
  claimReplyHours: 48,
  payoutHoldDays: 0,
  payoutMin: 1000,
};

export const getPlatform = cache(async (): Promise<PlatformConfig> => {
  const rows = await db.select().from(platformSettings);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Partial<PlatformConfig>;
  const out = { ...DEFAULT_PLATFORM };
  for (const k of Object.keys(DEFAULT_PLATFORM) as (keyof PlatformConfig)[]) {
    const v = Number(map[k]);
    if (Number.isFinite(v) && v >= 0) out[k] = v;
  }
  return out;
});

export async function savePlatform(patch: Partial<PlatformConfig>) {
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in DEFAULT_PLATFORM) || !Number.isFinite(Number(value))) continue;
    await db
      .insert(platformSettings)
      .values({ key, value: Number(value) })
      .onConflictDoUpdate({ target: platformSettings.key, set: { value: Number(value), updatedAt: new Date() } });
  }
}

export function platformFee(total: number, cfg: PlatformConfig): number {
  return Math.min(total, Math.round((total * cfg.feeBp) / 10000) + cfg.feeFixed);
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** الدومين الجذر للنطاقات الفرعية للمتاجر، مثل zaar.sa (اختياري) */
export function rootDomain(): string {
  return (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/** اليوم بتوقيت الرياض بصيغة YYYY-MM-DD */
export function riyadhDay(d = new Date()): string {
  return new Date(d.getTime() + 3 * 3600 * 1000).toISOString().slice(0, 10);
}

/** بداية اليوم الحالي بتوقيت الرياض كـ Date (UTC) */
export function riyadhMidnight(d = new Date()): Date {
  return new Date(`${riyadhDay(d)}T00:00:00+03:00`);
}
