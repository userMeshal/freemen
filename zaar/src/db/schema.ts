import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { StoreContent, StorePalette, StoreSettings, ProductArt, ProductOption, OrderEvent, CartLine } from "@/lib/types";

/** كل المبالغ بالهللة (integer) — الأسعار شاملة ضريبة القيمة المضافة. */

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

// ───────────────────────── التجار ─────────────────────────
export const merchants = pgTable(
  "merchants",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    passwordHash: text("password_hash").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("merchants_phone_uq").on(t.phone)],
);

// ───────────────────────── المتاجر ─────────────────────────
export const stores = pgTable(
  "stores",
  {
    id: serial("id").primaryKey(),
    /** null = مسودة أنشأها الذكاء الاصطناعي ولم تُربط بحساب بعد */
    merchantId: integer("merchant_id").references(() => merchants.id, { onDelete: "set null" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    /** كلمة لاتينية قصيرة تُستخدم في العناوين العملاقة (اختيارية) */
    nameLatin: text("name_latin").notNull().default(""),
    tagline: text("tagline").notNull().default(""),
    description: text("description").notNull().default(""),
    vertical: text("vertical").notNull().default("general"),
    theme: text("theme").$type<"bold" | "soft">().notNull().default("bold"),
    palette: jsonb("palette").$type<StorePalette>().notNull(),
    content: jsonb("content").$type<StoreContent>().notNull(),
    settings: jsonb("settings").$type<StoreSettings>().notNull(),
    status: text("status").$type<"draft" | "live" | "suspended">().notNull().default("draft"),
    /** رمز سري يثبت ملكية المسودة قبل إنشاء الحساب */
    claimToken: text("claim_token"),
    /** الفكرة الأصلية كما كتبها التاجر */
    idea: text("idea").notNull().default(""),
    bankHolder: text("bank_holder").notNull().default(""),
    bankName: text("bank_name").notNull().default(""),
    iban: text("iban").notNull().default(""),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("stores_slug_uq").on(t.slug), index("stores_merchant_idx").on(t.merchantId)],
);

export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    storeId: integer("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    icon: text("icon").notNull().default("Sparkles"),
    position: integer("position").notNull().default(0),
  },
  (t) => [uniqueIndex("categories_store_slug_uq").on(t.storeId, t.slug)],
);

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    storeId: integer("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    price: integer("price").notNull(),
    compareAtPrice: integer("compare_at_price"),
    /** null = مخزون غير محدود */
    stock: integer("stock"),
    images: jsonb("images").$type<string[]>().notNull().default([]),
    /** لوحة فنية مولّدة تُعرض عند غياب الصور */
    art: jsonb("art").$type<ProductArt>().notNull(),
    /** خيار واحد اختياري (مقاس/لون/حجم) بقيمه */
    option: jsonb("option").$type<ProductOption | null>(),
    isFeatured: boolean("is_featured").notNull().default(false),
    status: text("status").$type<"active" | "hidden">().notNull().default("active"),
    position: integer("position").notNull().default(0),
    sold: integer("sold").notNull().default(0),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("products_store_slug_uq").on(t.storeId, t.slug), index("products_store_idx").on(t.storeId, t.status)],
);

// ───────────────────────── العملاء والطلبات ─────────────────────────
export const customers = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    storeId: integer("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email").notNull().default(""),
    city: text("city").notNull().default(""),
    ordersCount: integer("orders_count").notNull().default(0),
    totalSpent: integer("total_spent").notNull().default(0),
    createdAt: ts("created_at").notNull().defaultNow(),
    lastOrderAt: ts("last_order_at"),
  },
  (t) => [uniqueIndex("customers_store_phone_uq").on(t.storeId, t.phone)],
);

export type OrderStatus = "pending_payment" | "paid" | "processing" | "shipped" | "delivered" | "cancelled" | "refunded";
export type PaymentMethod = "card" | "tabby" | "tamara" | "cod";

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    storeId: integer("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    customerId: integer("customer_id").references(() => customers.id, { onDelete: "set null" }),
    number: text("number").notNull(),
    /** رمز سري في رابط التتبع — يغني العميل عن إنشاء حساب */
    token: text("token").notNull(),
    status: text("status").$type<OrderStatus>().notNull().default("pending_payment"),
    paymentMethod: text("payment_method").$type<PaymentMethod>().notNull(),
    paymentStatus: text("payment_status").$type<"unpaid" | "paid" | "failed" | "refunded">().notNull().default("unpaid"),
    /** بوابة الدفع الفعلية: edfapay / tabby / tamara / test / cod */
    gateway: text("gateway").notNull().default(""),
    /** مرجع محاولة الدفع الحالية لدى البوابة */
    paymentRef: text("payment_ref"),
    gatewayPaymentId: text("gateway_payment_id"),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    customerEmail: text("customer_email").notNull().default(""),
    city: text("city").notNull(),
    address: text("address").notNull(),
    notes: text("notes").notNull().default(""),
    subtotal: integer("subtotal").notNull(),
    discount: integer("discount").notNull().default(0),
    shipping: integer("shipping").notNull().default(0),
    total: integer("total").notNull(),
    vat: integer("vat").notNull().default(0),
    couponCode: text("coupon_code"),
    /** عمولة زار المقتطعة من الطلب، وصافي التاجر */
    platformFee: integer("platform_fee").notNull().default(0),
    net: integer("net").notNull().default(0),
    shippingCompany: text("shipping_company").notNull().default(""),
    trackingNumber: text("tracking_number").notNull().default(""),
    events: jsonb("events").$type<OrderEvent[]>().notNull().default([]),
    paidAt: ts("paid_at"),
    shippedAt: ts("shipped_at"),
    deliveredAt: ts("delivered_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("orders_number_uq").on(t.number),
    index("orders_store_idx").on(t.storeId, t.createdAt),
    index("orders_payment_ref_idx").on(t.paymentRef),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    optionValue: text("option_value"),
    unitPrice: integer("unit_price").notNull(),
    qty: integer("qty").notNull(),
    image: text("image"),
    art: jsonb("art").$type<ProductArt | null>(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

export const coupons = pgTable(
  "coupons",
  {
    id: serial("id").primaryKey(),
    storeId: integer("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    type: text("type").$type<"percent" | "fixed" | "free_shipping">().notNull(),
    value: integer("value").notNull().default(0),
    minSubtotal: integer("min_subtotal").notNull().default(0),
    maxUses: integer("max_uses"),
    used: integer("used").notNull().default(0),
    expiresAt: ts("expires_at"),
    active: boolean("active").notNull().default(true),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("coupons_store_code_uq").on(t.storeId, t.code)],
);

// ───────────────────────── المحفظة والتحويل اليومي ─────────────────────────
/**
 * دفتر الأستاذ: كل حركة مالية تخص التاجر سطر موقّع (+ له / − عليه).
 * الرصيد = مجموع السطور غير المرحّلة لتحويل (payout_id is null).
 */
export type LedgerType = "sale" | "fee" | "refund" | "fee_reversal" | "payout_reversal" | "adjustment";

export const ledger = pgTable(
  "ledger",
  {
    id: serial("id").primaryKey(),
    storeId: integer("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    orderId: integer("order_id").references(() => orders.id, { onDelete: "set null" }),
    type: text("type").$type<LedgerType>().notNull(),
    amount: integer("amount").notNull(),
    note: text("note").notNull().default(""),
    payoutId: integer("payout_id"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("ledger_store_idx").on(t.storeId, t.payoutId), uniqueIndex("ledger_order_type_uq").on(t.orderId, t.type)],
);

export const payouts = pgTable(
  "payouts",
  {
    id: serial("id").primaryKey(),
    storeId: integer("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    status: text("status").$type<"pending" | "sent" | "failed">().notNull().default("pending"),
    /** يوم التسوية (بتوقيت الرياض) */
    day: date("day").notNull(),
    iban: text("iban").notNull().default(""),
    bankHolder: text("bank_holder").notNull().default(""),
    bankName: text("bank_name").notNull().default(""),
    reference: text("reference").notNull().default(""),
    ordersCount: integer("orders_count").notNull().default(0),
    createdAt: ts("created_at").notNull().defaultNow(),
    sentAt: ts("sent_at"),
  },
  (t) => [uniqueIndex("payouts_store_day_uq").on(t.storeId, t.day), index("payouts_status_idx").on(t.status)],
);

// ───────────────────────── ضمان زار ─────────────────────────
export type ClaimStatus = "open" | "merchant_replied" | "approved" | "rejected";

export const claims = pgTable(
  "claims",
  {
    id: serial("id").primaryKey(),
    storeId: integer("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    details: text("details").notNull().default(""),
    status: text("status").$type<ClaimStatus>().notNull().default("open"),
    merchantReply: text("merchant_reply").notNull().default(""),
    resolution: text("resolution").notNull().default(""),
    amount: integer("amount").notNull(),
    /** هل نُفّذ الاسترداد فعليًا عبر بوابة الدفع أم ينتظر تحويلًا يدويًا */
    refundState: text("refund_state").$type<"none" | "gateway" | "manual_pending" | "manual_done">().notNull().default("none"),
    createdAt: ts("created_at").notNull().defaultNow(),
    repliedAt: ts("replied_at"),
    resolvedAt: ts("resolved_at"),
  },
  (t) => [uniqueIndex("claims_order_uq").on(t.orderId), index("claims_store_idx").on(t.storeId, t.status)],
);

export const reviews = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    storeId: integer("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    rating: integer("rating").notNull(),
    body: text("body").notNull().default(""),
    hidden: boolean("hidden").notNull().default(false),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("reviews_order_product_uq").on(t.orderId, t.productId), index("reviews_product_idx").on(t.productId)],
);

/** السلال المتروكة: تُسجَّل عند كتابة الجوال في صفحة الدفع وتُغلق عند إتمام الطلب */
export const abandonedCarts = pgTable(
  "abandoned_carts",
  {
    id: serial("id").primaryKey(),
    storeId: integer("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    phone: text("phone").notNull(),
    name: text("name").notNull().default(""),
    items: jsonb("items").$type<CartLine[]>().notNull(),
    total: integer("total").notNull(),
    recovered: boolean("recovered").notNull().default(false),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("abandoned_store_phone_uq").on(t.storeId, t.phone)],
);

/** عدّادات يومية للتحليلات (بدون تتبع أفراد) */
export const dailyStats = pgTable(
  "daily_stats",
  {
    storeId: integer("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    views: integer("views").notNull().default(0),
    productViews: integer("product_views").notNull().default(0),
    addToCart: integer("add_to_cart").notNull().default(0),
    checkouts: integer("checkouts").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.storeId, t.day] })],
);

export const platformSettings = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  resetAt: ts("reset_at").notNull(),
});

/** تسلسل أرقام الطلبات */
export const counters = pgTable("counters", {
  key: text("key").primaryKey(),
  value: bigint("value", { mode: "number" }).notNull().default(sql`0`),
});

// ───────────────────────── العلاقات ─────────────────────────
export const storesRelations = relations(stores, ({ one, many }) => ({
  merchant: one(merchants, { fields: [stores.merchantId], references: [merchants.id] }),
  categories: many(categories),
  products: many(products),
}));
export const productsRelations = relations(products, ({ one }) => ({
  store: one(stores, { fields: [products.storeId], references: [stores.id] }),
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
}));
export const categoriesRelations = relations(categories, ({ one, many }) => ({
  store: one(stores, { fields: [categories.storeId], references: [stores.id] }),
  products: many(products),
}));
export const ordersRelations = relations(orders, ({ one, many }) => ({
  store: one(stores, { fields: [orders.storeId], references: [stores.id] }),
  items: many(orderItems),
}));
export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
}));

export type Store = typeof stores.$inferSelect;
export type Merchant = typeof merchants.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
export type Payout = typeof payouts.$inferSelect;
export type Claim = typeof claims.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Customer = typeof customers.$inferSelect;
