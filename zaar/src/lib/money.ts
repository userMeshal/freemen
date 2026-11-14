/** المبالغ بالهللة. 14600 → "146" ، 14650 → "146.50" */
export function formatAmount(halalas: number): string {
  const v = halalas / 100;
  return Number.isInteger(v)
    ? v.toLocaleString("en-US")
    : v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatSar(halalas: number): string {
  return `${formatAmount(halalas)} ر.س`;
}

export function toHalalas(value: string | number): number {
  const n = typeof value === "number" ? value : parseFloat(String(value).replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function discountPercent(price: number, compareAt: number | null | undefined): number | null {
  if (!compareAt || compareAt <= price) return null;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

/** الضريبة المضمّنة داخل مبلغ شامل للضريبة */
export function vatIncluded(total: number, ratePercent: number): number {
  if (!ratePercent) return 0;
  return Math.round(total - total / (1 + ratePercent / 100));
}

/** أرقام عربية/فارسية → لاتينية */
export function latinDigits(s: string): string {
  return s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
}

/** يوحّد رقم الجوال السعودي إلى 05XXXXXXXX، أو null إن لم يكن صالحًا */
export function normalizePhone(input: string): string | null {
  let d = latinDigits(input).replace(/\D/g, "");
  if (d.startsWith("00966")) d = d.slice(5);
  else if (d.startsWith("966")) d = d.slice(3);
  if (d.length === 9 && d.startsWith("5")) d = `0${d}`;
  return /^05\d{8}$/.test(d) ? d : null;
}
