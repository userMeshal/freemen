"use client";

/**
 * واجهة موحّدة لأحداث Meta Pixel و TikTok Pixel.
 * تعمل فقط إذا تم ضبط معرّفات البكسل من لوحة التحكم ← الإعدادات.
 */
type Item = { id: string | number; name: string; price: number; qty?: number };

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    ttq?: { track: (event: string, params?: Record<string, unknown>) => void; page: () => void };
  }
}

const sar = (halalas: number) => Number((halalas / 100).toFixed(2));

function fb(event: string, params?: Record<string, unknown>, eventId?: string) {
  if (typeof window === "undefined" || !window.fbq) return;
  if (eventId) window.fbq("track", event, params, { eventID: eventId });
  else window.fbq("track", event, params);
}

function tt(event: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined" || !window.ttq) return;
  window.ttq.track(event, params);
}

function contents(items: Item[]) {
  return items.map((i) => ({ id: String(i.id), quantity: i.qty ?? 1, item_price: sar(i.price) }));
}
function ttContents(items: Item[]) {
  return items.map((i) => ({
    content_id: String(i.id),
    content_type: "product",
    content_name: i.name,
    quantity: i.qty ?? 1,
    price: sar(i.price),
  }));
}
const valueOf = (items: Item[]) => sar(items.reduce((s, i) => s + i.price * (i.qty ?? 1), 0));

export const pixel = {
  pageView() {
    if (typeof window === "undefined") return;
    window.fbq?.("track", "PageView");
    window.ttq?.page();
  },
  viewContent(item: Item) {
    fb("ViewContent", {
      content_ids: [String(item.id)],
      content_type: "product",
      content_name: item.name,
      value: sar(item.price),
      currency: "SAR",
    });
    tt("ViewContent", { contents: ttContents([item]), value: sar(item.price), currency: "SAR" });
  },
  search(query: string) {
    fb("Search", { search_string: query });
    tt("Search", { query });
  },
  addToCart(item: Item) {
    const value = valueOf([item]);
    fb("AddToCart", {
      content_ids: [String(item.id)],
      content_type: "product",
      content_name: item.name,
      contents: contents([item]),
      value,
      currency: "SAR",
    });
    tt("AddToCart", { contents: ttContents([item]), value, currency: "SAR" });
  },
  initiateCheckout(items: Item[]) {
    const value = valueOf(items);
    fb("InitiateCheckout", {
      content_ids: items.map((i) => String(i.id)),
      contents: contents(items),
      num_items: items.reduce((n, i) => n + (i.qty ?? 1), 0),
      value,
      currency: "SAR",
    });
    tt("InitiateCheckout", { contents: ttContents(items), value, currency: "SAR" });
  },
  addPaymentInfo(totalHalalas: number) {
    fb("AddPaymentInfo", { value: sar(totalHalalas), currency: "SAR" });
    tt("AddPaymentInfo", { value: sar(totalHalalas), currency: "SAR" });
  },
  purchase(orderNumber: string, totalHalalas: number, items: Item[]) {
    fb(
      "Purchase",
      {
        content_ids: items.map((i) => String(i.id)),
        content_type: "product",
        contents: contents(items),
        num_items: items.reduce((n, i) => n + (i.qty ?? 1), 0),
        value: sar(totalHalalas),
        currency: "SAR",
        order_id: orderNumber,
      },
      `purchase-${orderNumber}`,
    );
    tt("CompletePayment", {
      contents: ttContents(items),
      value: sar(totalHalalas),
      currency: "SAR",
      order_id: orderNumber,
    });
  },
};
