import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { coupons, products, type Coupon, type Store } from "@/db/schema";
import { vatIncluded } from "./money";
import type { CartLine, Quote } from "./types";

export type CartInput = { productId: number; optionValue: string | null; qty: number };

/** التسعير يتم على الخادم فقط: الأسعار والمخزون من القاعدة، وما يرسله المتصفح مجرد معرّفات وكميات */
export async function quoteCart(store: Store, input: CartInput[], couponCode?: string | null): Promise<Quote> {
  const wanted = input.filter((l) => Number.isInteger(l.productId) && l.qty > 0).slice(0, 40);
  const ids = [...new Set(wanted.map((l) => l.productId))];
  const rows = ids.length
    ? await db
        .select()
        .from(products)
        .where(and(eq(products.storeId, store.id), eq(products.status, "active"), inArray(products.id, ids)))
    : [];
  const byId = new Map(rows.map((p) => [p.id, p]));

  const taken = new Map<number, number>();
  const lines: Quote["lines"] = [];
  for (const l of wanted) {
    const p = byId.get(l.productId);
    if (!p) continue;
    const option = p.option ? (p.option.values.includes(l.optionValue ?? "") ? l.optionValue : p.option.values[0]) : null;
    const used = taken.get(p.id) ?? 0;
    const left = p.stock === null ? 99 : Math.max(0, p.stock - used);
    const qty = Math.min(Math.max(1, Math.floor(l.qty)), 20, left);
    taken.set(p.id, used + qty);
    const line: CartLine = {
      productId: p.id,
      slug: p.slug,
      name: p.name,
      optionValue: option,
      unitPrice: p.price,
      qty: Math.max(qty, 0),
      image: p.images[0] ?? null,
      art: p.art,
    };
    lines.push({ ...line, lineTotal: p.price * line.qty, available: qty > 0 });
  }

  const live = lines.filter((l) => l.available);
  const subtotal = live.reduce((s, l) => s + l.lineTotal, 0);
  const settings = store.settings;
  let shipping = !live.length ? 0 : settings.freeShippingOver > 0 && subtotal >= settings.freeShippingOver ? 0 : settings.shippingFee;
  let discount = 0;
  let coupon: Quote["coupon"] = null;
  let couponError: string | null = null;

  const code = (couponCode ?? "").trim().toUpperCase();
  if (code && live.length) {
    const found = await db
      .select()
      .from(coupons)
      .where(and(eq(coupons.storeId, store.id), eq(coupons.code, code)))
      .limit(1);
    const c = found[0];
    const problem = couponProblem(c, subtotal);
    if (problem || !c) couponError = problem ?? "الكوبون غير صحيح";
    else {
      if (c.type === "percent") discount = Math.round((subtotal * Math.min(c.value, 100)) / 100);
      else if (c.type === "fixed") discount = Math.min(c.value, subtotal);
      else shipping = 0;
      coupon = {
        code: c.code,
        label: c.type === "percent" ? `خصم ${c.value}%` : c.type === "fixed" ? `خصم ${c.value / 100} ر.س` : "شحن مجاني",
      };
    }
  }

  const total = Math.max(0, subtotal - discount) + shipping;
  return {
    lines,
    subtotal,
    discount,
    shipping,
    total,
    vat: vatIncluded(total, settings.vatRate ?? 15),
    coupon,
    couponError,
    freeShippingLeft: settings.freeShippingOver > 0 && live.length ? Math.max(0, settings.freeShippingOver - subtotal) : 0,
  };
}

function couponProblem(c: Coupon | undefined, subtotal: number): string | null {
  if (!c || !c.active) return "الكوبون غير صحيح";
  if (c.expiresAt && c.expiresAt.getTime() < Date.now()) return "انتهت صلاحية الكوبون";
  if (c.maxUses !== null && c.used >= c.maxUses) return "استُنفد عدد مرات استخدام الكوبون";
  if (subtotal < c.minSubtotal) return `الحد الأدنى لاستخدام الكوبون ${c.minSubtotal / 100} ر.س`;
  return null;
}
