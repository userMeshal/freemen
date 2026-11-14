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
