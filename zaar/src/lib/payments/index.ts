import "server-only";
import type { Order, OrderItem, Store } from "@/db/schema";
import { siteUrl } from "../platform";
import type { PaymentMethodId, PaymentOption } from "../types";
import { classifyStatus, edfapayInitiate, edfapayStatus } from "./edfapay";
import { tabbyCapture, tabbyConfigured, tabbyGet, tabbyRefund, tabbyStart } from "./tabby";
import { tamaraAuthorise, tamaraCapture, tamaraConfigured, tamaraGet, tamaraRefund, tamaraStart } from "./tamara";

/**
 * طبقة الدفع الموحّدة. زار هي التاجر المسجّل لدى البوابات: تستلم المبالغ ثم تحوّلها للتجار يوميًا.
 *
 * وضع الاختبار (ZAAR_TEST_PAYMENTS=1، وهو الافتراضي خارج الإنتاج): أي وسيلة لم تُضبط مفاتيحها
 * تمرّ عبر صفحة دفع تجريبية داخلية حتى تُجرَّب الدورة كاملة. في الإنتاج لا تظهر إلا الوسائل المضبوطة.
 */

export function testPaymentsEnabled(): boolean {
  const flag = process.env.ZAAR_TEST_PAYMENTS;
  if (flag === "1" || flag === "true") return true;
  if (flag === "0" || flag === "false") return false;
  return process.env.NODE_ENV !== "production";
}

export function edfapayConfigured(): boolean {
  return Boolean(process.env.EDFAPAY_API_KEY);
}

const META: Record<PaymentMethodId, { label: string; note: string; live: () => boolean }> = {
  card: { label: "بطاقة مدى / فيزا / ماستركارد / Apple Pay", note: "دفع فوري آمن", live: edfapayConfigured },
  tabby: { label: "تابي", note: "قسّمها على 4 دفعات بدون فوائد", live: tabbyConfigured },
  tamara: { label: "تمارا", note: "قسّمها على 3 دفعات بدون رسوم", live: tamaraConfigured },
};

export function paymentOptions(): PaymentOption[] {
  const test = testPaymentsEnabled();
  return (Object.keys(META) as PaymentMethodId[])
    .filter((id) => META[id].live() || test)
    .map((id) => ({ id, label: META[id].label, note: META[id].note, test: !META[id].live() }));
}

export function gatewayFor(method: PaymentMethodId): "edfapay" | "tabby" | "tamara" | "test" | null {
  if (META[method].live()) return method === "card" ? "edfapay" : method;
  return testPaymentsEnabled() ? "test" : null;
}

export type StartResult = { redirectUrl: string; gateway: string; gatewayPaymentId: string | null };

export async function startPayment(order: Order, items: OrderItem[], store: Store, ref: string): Promise<StartResult> {
  const method = order.paymentMethod as PaymentMethodId;
  const gateway = gatewayFor(method);
  if (!gateway) throw new Error("وسيلة الدفع غير متاحة");
  const site = siteUrl();
  const back = (state: string) => `${site}/pay/return?ref=${encodeURIComponent(ref)}&state=${state}`;
  const lines = items.map((i) => ({ id: String(i.productId ?? i.id), title: i.name, qty: i.qty, unitPrice: i.unitPrice }));
  const customer = { name: order.customerName, phone: order.customerPhone, email: order.customerEmail };
  const address = { city: order.city, address: order.address };

  if (gateway === "test") {
    return { redirectUrl: `${site}/pay/test/${encodeURIComponent(ref)}`, gateway, gatewayPaymentId: null };
  }
  if (gateway === "edfapay") {
    const r = await edfapayInitiate({
      orderRef: ref,
      amountHalalas: order.total,
      customer: { ...customer, email: customer.email || `${customer.phone}@customers.zaar.sa` },
      address,
      successUrl: back("success"),
      failureUrl: back("failure"),
    });
    return { redirectUrl: r.redirectUrl, gateway, gatewayPaymentId: null };
  }
  const common = {
    ref,
    orderNumber: order.number,
    total: order.total,
    shipping: order.shipping,
    discount: order.discount,
    vat: order.vat,
    storeName: store.name,
    customer,
    address,
    items: lines,
  };
  if (gateway === "tabby") {
    const r = await tabbyStart({ ...common, urls: { success: back("success"), cancel: back("cancel"), failure: back("failure") } });
    return { redirectUrl: r.redirectUrl, gateway, gatewayPaymentId: r.paymentId };
  }
  const r = await tamaraStart({
    ...common,
    urls: { success: back("success"), cancel: back("cancel"), failure: back("failure"), notification: `${site}/api/webhooks/tamara` },
  });
  return { redirectUrl: r.redirectUrl, gateway, gatewayPaymentId: r.orderId };
}

export type VerifyResult = { outcome: "paid" | "failed" | "pending"; gatewayPaymentId: string | null };

/**
 * يسأل البوابة مباشرة عن حالة الدفع (مصدر الحقيقة) ويطابق المرجع والمبلغ.
 * `hint` معرّف العملية القادم من رابط العودة أو الـ webhook (لـ EdfaPay الذي لا يعطي معرّفًا عند الإنشاء).
 */
export async function verifyPayment(order: Order, hint?: string | null): Promise<VerifyResult> {
  const id = order.gatewayPaymentId ?? hint ?? null;
  if (order.gateway === "edfapay") {
    if (!id) return { outcome: "pending", gatewayPaymentId: null };
    const tx = await edfapayStatus(id).catch(() => null);
    if (!tx || String(tx.orderId) !== order.paymentRef) return { outcome: "pending", gatewayPaymentId: id };
    const outcome = classifyStatus(tx.paymentStatus ?? tx.transactionStatus);
    if (outcome === "approved") {
      return Math.round(Number(tx.amount) * 100) === order.total ? { outcome: "paid", gatewayPaymentId: id } : { outcome: "failed", gatewayPaymentId: id };
    }
    return { outcome: outcome === "declined" ? "failed" : "pending", gatewayPaymentId: id };
  }
  if (order.gateway === "tabby") {
    if (!id) return { outcome: "pending", gatewayPaymentId: null };
    let p = await tabbyGet(id).catch(() => null);
    if (!p || p.order?.reference_id !== order.paymentRef) return { outcome: "pending", gatewayPaymentId: id };
    if (Math.round(Number(p.amount) * 100) !== order.total) return { outcome: "failed", gatewayPaymentId: id };
    if (p.status === "AUTHORIZED") {
      await tabbyCapture(id, order.total).catch(() => false);
      p = (await tabbyGet(id).catch(() => null)) ?? p;
    }
    if (p.status === "CLOSED" || p.status === "AUTHORIZED") return { outcome: "paid", gatewayPaymentId: id };
    if (p.status === "REJECTED" || p.status === "EXPIRED") return { outcome: "failed", gatewayPaymentId: id };
    return { outcome: "pending", gatewayPaymentId: id };
  }
  if (order.gateway === "tamara") {
    if (!id) return { outcome: "pending", gatewayPaymentId: null };
    let o = await tamaraGet(id).catch(() => null);
    if (!o || (o.order_reference_id && o.order_reference_id !== order.paymentRef)) return { outcome: "pending", gatewayPaymentId: id };
    if (o.status === "approved") {
      await tamaraAuthorise(id).catch(() => false);
      o = (await tamaraGet(id).catch(() => null)) ?? o;
    }
    if (o.status === "authorised") {
      await tamaraCapture(id, order.total, order.shipping, order.vat).catch(() => false);
      return { outcome: "paid", gatewayPaymentId: id };
    }
    if (["fully_captured", "partially_captured"].includes(o.status)) return { outcome: "paid", gatewayPaymentId: id };
    if (["declined", "expired", "canceled"].includes(o.status)) return { outcome: "failed", gatewayPaymentId: id };
    return { outcome: "pending", gatewayPaymentId: id };
  }
  // بوابة الاختبار تُحسم من صفحتها مباشرة
  return { outcome: "pending", gatewayPaymentId: id };
}

/**
 * يحاول ردّ المبلغ عبر البوابة. يرجع "gateway" إن تم آليًا، و"manual" إن كان يحتاج تنفيذًا يدويًا
 * من لوحة البوابة (EdfaPay حاليًا) ثم تأكيده من لوحة زار.
 */
export async function refundPayment(order: Order, reason: string): Promise<"gateway" | "manual"> {
  try {
    if (order.gateway === "test") return "gateway";
    if (order.gateway === "tabby" && order.gatewayPaymentId) return (await tabbyRefund(order.gatewayPaymentId, order.total, reason)) ? "gateway" : "manual";
    if (order.gateway === "tamara" && order.gatewayPaymentId) return (await tamaraRefund(order.gatewayPaymentId, order.total, reason)) ? "gateway" : "manual";
  } catch (e) {
    console.error("[refund] gateway refund failed", order.number, e);
  }
  return "manual";
}
