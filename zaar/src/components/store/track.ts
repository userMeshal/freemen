"use client";

/** أحداث التسويق: تُرسل لبكسلات ميتا / تيك توك / سناب إن كانت مفعّلة، ولعدّادات المتجر الداخلية */
type W = Window & {
  fbq?: (...a: unknown[]) => void;
  ttq?: { track: (e: string, p?: unknown) => void; page: () => void };
  snaptr?: (...a: unknown[]) => void;
};

function beacon(slug: string, event: string) {
  try {
    const body = JSON.stringify({ slug, event });
    if (!navigator.sendBeacon?.("/api/track", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/track", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
    }
  } catch {}
}

export const track = {
  view(slug: string) {
    beacon(slug, "views");
  },
  product(slug: string, p: { id: number; name: string; price: number }) {
    beacon(slug, "productViews");
    const w = window as W;
    const value = p.price / 100;
    w.fbq?.("track", "ViewContent", { content_ids: [String(p.id)], content_name: p.name, content_type: "product", value, currency: "SAR" });
    w.ttq?.track("ViewContent", { content_id: String(p.id), content_name: p.name, value, currency: "SAR" });
    w.snaptr?.("track", "VIEW_CONTENT", { item_ids: [String(p.id)], price: value, currency: "SAR" });
  },
  addToCart(slug: string, p: { id: number; name: string; price: number }) {
    beacon(slug, "addToCart");
    const w = window as W;
    const value = p.price / 100;
    w.fbq?.("track", "AddToCart", { content_ids: [String(p.id)], content_name: p.name, content_type: "product", value, currency: "SAR" });
    w.ttq?.track("AddToCart", { content_id: String(p.id), content_name: p.name, value, currency: "SAR" });
    w.snaptr?.("track", "ADD_CART", { item_ids: [String(p.id)], price: value, currency: "SAR" });
  },
  checkout(slug: string, total: number) {
    beacon(slug, "checkouts");
    const w = window as W;
    w.fbq?.("track", "InitiateCheckout", { value: total / 100, currency: "SAR" });
    w.ttq?.track("InitiateCheckout", { value: total / 100, currency: "SAR" });
    w.snaptr?.("track", "START_CHECKOUT", { price: total / 100, currency: "SAR" });
  },
  purchase(orderNumber: string, total: number) {
    const w = window as W;
    w.fbq?.("track", "Purchase", { value: total / 100, currency: "SAR" }, { eventID: orderNumber });
    w.ttq?.track("CompletePayment", { value: total / 100, currency: "SAR", order_id: orderNumber });
    w.snaptr?.("track", "PURCHASE", { price: total / 100, currency: "SAR", transaction_id: orderNumber });
  },
};
