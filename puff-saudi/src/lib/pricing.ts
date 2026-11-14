import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { coupons, productImages, products, shippingMethods, variants } from "@/db/schema";
import { edfapayConfigured, getSettings } from "./settings";
import { formatSar, vatIncluded } from "./money";
import type { CartLineInput, CartQuote, PricedLine, ShippingOption } from "./types";

export const MAX_QTY_PER_LINE = 20;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;

export type CouponRow = typeof coupons.$inferSelect;

export function evaluateCoupon(
  coupon: CouponRow | undefined,
  subtotal: number,
): { ok: true; discount: number; freeShipping: boolean; label: string } | { ok: false; error: string } {
  if (!coupon || !coupon.isActive) return { ok: false, error: "الكوبون غير صحيح" };
  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) return { ok: false, error: "الكوبون لم يبدأ بعد" };
  if (coupon.endsAt && coupon.endsAt < now) return { ok: false, error: "انتهت صلاحية الكوبون" };
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit)
    return { ok: false, error: "تم استنفاد عدد مرات استخدام الكوبون" };
  if (subtotal < coupon.minSubtotal)
    return { ok: false, error: `الحد الأدنى لاستخدام الكوبون ${formatSar(coupon.minSubtotal)}` };

  if (coupon.type === "free_shipping") return { ok: true, discount: 0, freeShipping: true, label: "شحن مجاني" };
  if (coupon.type === "percent") {
    let discount = Math.round((subtotal * Math.min(100, Math.max(0, coupon.value))) / 100);
    if (coupon.maxDiscount !== null) discount = Math.min(discount, coupon.maxDiscount);
    return { ok: true, discount: Math.min(discount, subtotal), freeShipping: false, label: `خصم ${coupon.value}%` };
  }
  return {
    ok: true,
    discount: Math.min(coupon.value, subtotal),
    freeShipping: false,
    label: `خصم ${formatSar(coupon.value)}`,
  };
}

export type QuoteOptions = {
  couponCode?: string | null;
  shippingMethodId?: number | null;
  paymentMethod?: "edfapay" | "cod" | null;
};

export async function quoteCart(
  items: CartLineInput[],
  opts: QuoteOptions = {},
  executor: Executor = db,
): Promise<CartQuote & { couponRow: CouponRow | null }> {
  const settings = await getSettings();

  // دمج البنود المكررة وتنظيف الكميات
  const wanted = new Map<number, number>();
  for (const it of items) {
    const id = Number(it.variantId);
    const qty = Math.floor(Number(it.qty));
    if (!Number.isInteger(id) || id <= 0 || !Number.isFinite(qty) || qty <= 0) continue;
    wanted.set(id, Math.min(MAX_QTY_PER_LINE, (wanted.get(id) ?? 0) + qty));
  }
  const ids = [...wanted.keys()].slice(0, 60);

  const rows = ids.length
    ? await executor
        .select({ v: variants, p: products })
        .from(variants)
        .innerJoin(products, eq(variants.productId, products.id))
        .where(and(inArray(variants.id, ids), eq(variants.isActive, true), eq(products.status, "active")))
    : [];

  const productIds = [...new Set(rows.map((r) => r.p.id))];
  const imgs = productIds.length
    ? await executor
        .select()
        .from(productImages)
        .where(inArray(productImages.productId, productIds))
        .orderBy(asc(productImages.position), asc(productImages.id))
    : [];
  const imgById = new Map(imgs.map((i) => [i.id, i]));
  const firstImg = new Map<number, (typeof imgs)[number]>();
  for (const i of imgs) if (!firstImg.has(i.productId)) firstImg.set(i.productId, i);

  const lines: PricedLine[] = [];
  const removed: number[] = [];
  let adjusted = false;
  const byId = new Map(rows.map((r) => [r.v.id, r]));
  for (const id of ids) {
    const r = byId.get(id);
    if (!r) {
      removed.push(id);
      continue;
    }
    let qty = wanted.get(id)!;
    if (r.v.stock !== null) {
      if (r.v.stock <= 0) {
        removed.push(id);
        continue;
      }
      if (qty > r.v.stock) {
        qty = r.v.stock;
        adjusted = true;
      }
    }
    const img = (r.v.imageId ? imgById.get(r.v.imageId) : undefined) ?? firstImg.get(r.p.id);
    lines.push({
      variantId: r.v.id,
      productId: r.p.id,
      slug: r.p.slug,
      name: r.p.name,
      optionName: r.p.optionName,
      optionValue: r.v.optionValue,
      sku: r.v.sku,
      imageUrl: img?.url ?? null,
      bg: img?.bg ?? "#F5F1E8",
      unitPrice: r.v.price,
      compareAtPrice: r.v.compareAtPrice,
      qty,
      total: r.v.price * qty,
      maxQty: r.v.stock === null ? MAX_QTY_PER_LINE : Math.min(MAX_QTY_PER_LINE, r.v.stock),
    });
  }
  // أي متغير طُلب أصلًا ولم يُحمَّل (تجاوز الحد)
  for (const id of wanted.keys()) if (!ids.includes(id)) removed.push(id);

  const subtotal = lines.reduce((s, l) => s + l.total, 0);

  // الكوبون
  let discount = 0;
  let freeShipping = false;
  let coupon: CartQuote["coupon"] = null;
  let couponError: string | null = null;
  let couponRow: CouponRow | null = null;
  const code = opts.couponCode?.trim().toUpperCase();
  if (code && lines.length) {
    const found = await executor.select().from(coupons).where(eq(coupons.code, code)).limit(1);
    const res = evaluateCoupon(found[0], subtotal);
    if (res.ok) {
      discount = res.discount;
      freeShipping = res.freeShipping;
      coupon = { code, label: res.label };
      couponRow = found[0];
    } else couponError = res.error;
  }

  // الشحن
  const methods = await executor
    .select()
    .from(shippingMethods)
    .where(eq(shippingMethods.isActive, true))
    .orderBy(asc(shippingMethods.position), asc(shippingMethods.id));
  const afterDiscount = subtotal - discount;
  const shippingOptions: ShippingOption[] = methods.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    price: m.price,
    freeAbove: m.freeAbove,
    effectivePrice: freeShipping || (m.freeAbove !== null && afterDiscount >= m.freeAbove) ? 0 : m.price,
  }));
  const selected = shippingOptions.find((m) => m.id === opts.shippingMethodId) ?? shippingOptions[0] ?? null;
  const shipping = lines.length && selected ? selected.effectivePrice : 0;

  const payment = {
    edfapay: settings.edfapayEnabled && edfapayConfigured(),
    cod: settings.codEnabled,
    codFee: settings.codFee,
  };
  const codFee = lines.length && opts.paymentMethod === "cod" && payment.cod ? settings.codFee : 0;
  const total = Math.max(0, afterDiscount + shipping + codFee);

  return {
    lines,
    removed,
    adjusted,
    subtotal,
    discount,
    shipping,
    codFee,
    total,
    vatAmount: vatIncluded(total, settings.vatRate),
    vatRate: settings.vatRate,
    coupon,
    couponError,
    couponRow,
    shippingOptions,
    shippingMethodId: selected?.id ?? null,
    payment,
  };
}
