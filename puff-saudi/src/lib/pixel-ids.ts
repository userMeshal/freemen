/**
 * صيغ معرّفات منصات التتبع — تُستعمل للتحقق عند الحفظ في لوحة التحكم، ومرة ثانية قبل وضع المعرّف
 * داخل سكربت في صفحات المتجر (حتى لا يصل للصفحة أي نص لا يطابق الصيغة).
 */
export type PixelIds = {
  metaPixelId: string;
  tiktokPixelId: string;
  snapPixelId: string;
  googleAnalyticsId: string;
  googleAdsId: string;
  googleAdsPurchaseLabel: string;
  googleTagManagerId: string;
  xPixelId: string;
  xPurchaseEventId: string;
  pinterestTagId: string;
};

export const PIXEL_ID_RULES: Record<keyof PixelIds, RegExp> = {
  metaPixelId: /^\d{5,20}$/,
  tiktokPixelId: /^[A-Z0-9]{5,40}$/,
  snapPixelId: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  googleAnalyticsId: /^G-[A-Z0-9]{4,20}$/,
  googleAdsId: /^AW-\d{6,15}$/,
  googleAdsPurchaseLabel: /^[A-Za-z0-9_-]{5,40}$/,
  googleTagManagerId: /^GTM-[A-Z0-9]{4,12}$/,
  xPixelId: /^[a-z0-9]{4,12}$/,
  xPurchaseEventId: /^tw-[a-z0-9]{4,12}-[a-z0-9]{4,12}$/,
  pinterestTagId: /^\d{10,20}$/,
};

export const PIXEL_KEYS = Object.keys(PIXEL_ID_RULES) as (keyof PixelIds)[];

/** يبقي المعرّفات المطابقة للصيغة فقط ويفرّغ الباقي */
export function validPixelIds(input: Partial<PixelIds>): PixelIds {
  const out = {} as PixelIds;
  for (const key of PIXEL_KEYS) {
    const value = (input[key] ?? "").trim();
    out[key] = PIXEL_ID_RULES[key].test(value) ? value : "";
  }
  return out;
}
