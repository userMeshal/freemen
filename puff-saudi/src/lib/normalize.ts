const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

export function toLatinDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (d) => {
    const i = AR_DIGITS.indexOf(d);
    return String(i >= 0 ? i : FA_DIGITS.indexOf(d));
  });
}

/** تطبيع النص العربي للبحث: إزالة التشكيل وتوحيد الألف والتاء المربوطة والياء */
export function normalizeArabic(input: string): string {
  return toLatinDigits(input)
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[ىئ]/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** يحوّل أرقام الجوال السعودية لصيغة موحدة 9665XXXXXXXX ، أو null إن كانت غير صالحة */
export function normalizeSaudiPhone(input: string): string | null {
  let d = toLatinDigits(input).replace(/\D/g, "");
  if (d.startsWith("00966")) d = d.slice(5);
  else if (d.startsWith("966")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  if (!/^5\d{8}$/.test(d)) return null;
  return `966${d}`;
}

export function displayPhone(normalized: string): string {
  return normalized.startsWith("966") ? `0${normalized.slice(3)}` : normalized;
}

export function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function slugify(input: string): string {
  return toLatinDigits(input)
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

/** تنظيف HTML القادم من لوحة التحكم: يسمح بوسوم التنسيق البسيطة فقط */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<(script|style|iframe|object|embed|form|link|meta)[\s\S]*?<\/\1>/gi, "")
    .replace(/<(script|style|iframe|object|embed|form|link|meta)[^>]*\/?>/gi, "")
    .replace(/<(\/?)([a-z0-9]+)([^>]*)>/gi, (_m, close: string, tag: string) => {
      const t = tag.toLowerCase();
      const allowed = ["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "h2", "h3", "h4", "blockquote"];
      return allowed.includes(t) ? `<${close}${t}>` : "";
    });
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
