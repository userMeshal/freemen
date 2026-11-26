"use client";

/**
 * واجهة موحّدة لأحداث منصات التتبع: Meta، TikTok، Snapchat، Google (Analytics 4 / Ads / Tag Manager)،
 * X (تويتر)، و Pinterest. كل منصة تعمل فقط إذا ضُبط معرّفها من لوحة التحكم ← الإعدادات
 * (السكربتات تُحمَّل في components/site/Pixels.tsx).
 */
type Item = { id: string | number; name: string; price: number; qty?: number };
type Params = Record<string, unknown>;

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    ttq?: { track: (event: string, params?: Params) => void; page: () => void };
    snaptr?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    twq?: (...args: unknown[]) => void;
    pintrk?: (...args: unknown[]) => void;
    __puffPixels?: { gtag: boolean; gtm: boolean; adsPurchase: string; xPurchase: string };
    __puffPixelsReady?: boolean;
  }
}

const sar = (halalas: number) => Number((halalas / 100).toFixed(2));
const on = () => typeof window !== "undefined";
const cfg = () => (on() && window.__puffPixels) || { gtag: false, gtm: false, adsPurchase: "", xPurchase: "" };

function fb(event: string, params?: Params, eventId?: string) {
  if (!on() || !window.fbq) return;
  if (eventId) window.fbq("track", event, params, { eventID: eventId });
  else window.fbq("track", event, params);
}

function tt(event: string, params?: Params) {
  if (!on() || !window.ttq) return;
  window.ttq.track(event, params);
}

function snap(event: string, params?: Params) {
  if (!on() || !window.snaptr) return;
  window.snaptr("track", event, params);
}

function pin(event: string, params?: Params) {
  if (!on() || !window.pintrk) return;
  window.pintrk("track", event, params);
}

/**
 * Google: الحدث بصيغة GA4 يذهب إلى gtag (Analytics و Ads) إن وُجد، وإلى dataLayer إن كانت هناك حاوية
 * Tag Manager (بصيغة ecommerce القياسية التي تقرؤها وسوم GA4 داخل الحاوية).
 */
function google(event: string, params: Params, ecommerce = true) {
  if (!on()) return;
  const c = cfg();
  if (c.gtag && window.gtag) window.gtag("event", event, params);
  if (c.gtm && window.dataLayer) {
    if (ecommerce) {
      window.dataLayer.push({ ecommerce: null });
      window.dataLayer.push({ event, ecommerce: params });
    } else {
      window.dataLayer.push({ event, ...params });
    }
  }
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
function gaItems(items: Item[]) {
  return items.map((i) => ({ item_id: String(i.id), item_name: i.name, price: sar(i.price), quantity: i.qty ?? 1 }));
}
function pinItems(items: Item[]) {
  return items.map((i) => ({ product_id: String(i.id), product_name: i.name, product_price: sar(i.price), product_quantity: i.qty ?? 1 }));
}
const ids = (items: Item[]) => items.map((i) => String(i.id));
const count = (items: Item[]) => items.reduce((n, i) => n + (i.qty ?? 1), 0);
const valueOf = (items: Item[]) => sar(items.reduce((s, i) => s + i.price * (i.qty ?? 1), 0));

/**
 * سكربتات المنصات تُهيَّأ بعد اكتمال تحميل الصفحة، أما مكوّنات الصفحة فتطلق أحداثها فور ظهورها (مثل
 * «عرض المنتج» عند فتح صفحة المنتج مباشرة من إعلان). لذلك تنتظر الأحداث هنا حتى تجهز المنصات ثم تُرسَل،
 * بدل أن تضيع بصمت. Pixels.tsx يعلن الجاهزية بحدث puff:pixels-ready.
 */
const pending: (() => void)[] = [];
let listening = false;
function whenReady(send: () => void) {
  if (!on()) return;
  if (window.__puffPixelsReady) return send();
  if (pending.length < 40) pending.push(send);
  if (listening) return;
  listening = true;
  window.addEventListener(
    "puff:pixels-ready",
    () => {
      for (const queued of pending.splice(0)) {
        try {
          queued();
        } catch {}
      }
    },
    { once: true },
  );
}

const events = {
  /** تنقّل داخل الموقع (التحميل الأول تسجّله سكربتات التهيئة). Google يلتقط التنقّل تلقائيًا فلا نكرره. */
  pageView() {
    if (!on()) return;
    window.fbq?.("track", "PageView");
    window.ttq?.page();
    window.snaptr?.("track", "PAGE_VIEW");
    window.twq?.("track", "PageView");
    window.pintrk?.("page");
  },
  viewContent(item: Item) {
    const value = sar(item.price);
    fb("ViewContent", {
      content_ids: [String(item.id)],
      content_type: "product",
      content_name: item.name,
      value,
      currency: "SAR",
    });
    tt("ViewContent", { contents: ttContents([item]), value, currency: "SAR" });
    snap("VIEW_CONTENT", { item_ids: [String(item.id)], price: value, currency: "SAR" });
    google("view_item", { currency: "SAR", value, items: gaItems([item]) });
    pin("pagevisit", { product_id: String(item.id), value, currency: "SAR" });
  },
  search(query: string) {
    fb("Search", { search_string: query });
    tt("Search", { query });
    snap("SEARCH", { search_string: query });
    google("search", { search_term: query }, false);
    pin("search", { search_query: query });
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
    snap("ADD_CART", { item_ids: [String(item.id)], price: value, currency: "SAR", number_items: item.qty ?? 1 });
    google("add_to_cart", { currency: "SAR", value, items: gaItems([item]) });
    pin("addtocart", { value, order_quantity: item.qty ?? 1, currency: "SAR", line_items: pinItems([item]) });
  },
  initiateCheckout(items: Item[]) {
    const value = valueOf(items);
    fb("InitiateCheckout", {
      content_ids: ids(items),
      contents: contents(items),
      num_items: count(items),
      value,
      currency: "SAR",
    });
    tt("InitiateCheckout", { contents: ttContents(items), value, currency: "SAR" });
    snap("START_CHECKOUT", { item_ids: ids(items), price: value, currency: "SAR", number_items: count(items) });
    google("begin_checkout", { currency: "SAR", value, items: gaItems(items) });
  },
  addPaymentInfo(totalHalalas: number) {
    const value = sar(totalHalalas);
    fb("AddPaymentInfo", { value, currency: "SAR" });
    tt("AddPaymentInfo", { value, currency: "SAR" });
    snap("ADD_BILLING", { price: value, currency: "SAR" });
    google("add_payment_info", { currency: "SAR", value });
  },
  purchase(orderNumber: string, totalHalalas: number, items: Item[]) {
    const value = sar(totalHalalas);
    fb(
      "Purchase",
      {
        content_ids: ids(items),
        content_type: "product",
        contents: contents(items),
        num_items: count(items),
        value,
        currency: "SAR",
        order_id: orderNumber,
      },
      `purchase-${orderNumber}`,
    );
    tt("CompletePayment", {
      contents: ttContents(items),
      value,
      currency: "SAR",
      order_id: orderNumber,
    });
    snap("PURCHASE", { item_ids: ids(items), price: value, currency: "SAR", transaction_id: orderNumber, number_items: count(items) });
    google("purchase", { transaction_id: orderNumber, currency: "SAR", value, items: gaItems(items) });
    pin("checkout", { value, order_quantity: count(items), currency: "SAR", order_id: orderNumber, line_items: pinItems(items) });
    if (!on()) return;
    const c = cfg();
    // تحويل الشراء في Google Ads و X يحتاج معرّفًا خاصًا بالحدث يُنسخ من حساب الإعلانات
    if (c.adsPurchase && window.gtag) {
      window.gtag("event", "conversion", { send_to: c.adsPurchase, value, currency: "SAR", transaction_id: orderNumber });
    }
    if (c.xPurchase && window.twq) {
      window.twq("event", c.xPurchase, { value, currency: "SAR", conversion_id: orderNumber });
    }
  },
};

type Events = typeof events;
export const pixel = Object.fromEntries(
  Object.entries(events).map(([name, send]) => [name, (...args: unknown[]) => whenReady(() => (send as (...a: unknown[]) => void)(...args))]),
) as Events;
