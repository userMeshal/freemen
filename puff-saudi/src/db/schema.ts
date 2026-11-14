import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/* كل المبالغ تُخزَّن بالهللة (عدد صحيح): 146.00 ر.س = 14600 */

export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Address = {
  city: string;
  district: string;
  street: string;
  notes?: string;
};

export const customers = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone").notNull(),
    passwordHash: text("password_hash"),
    address: jsonb("address").$type<Address>(),
    notes: text("notes"),
    /** وقت إنشاء الحساب (كلمة المرور). الطلبات السابقة له كضيف لا تُعرض في صفحة الحساب */
    registeredAt: timestamp("registered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("customers_phone_idx").on(t.phone), uniqueIndex("customers_email_idx").on(t.email)],
);

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  position: integer("position").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    legacySlug: text("legacy_slug"),
    name: text("name").notNull(),
    family: text("family").notNull().default("other"),
    capacityMl: integer("capacity_ml"),
    colorName: text("color_name"),
    descriptionHtml: text("description_html").notNull().default(""),
    metaDescription: text("meta_description"),
    optionName: text("option_name"),
    price: integer("price").notNull(),
    compareAtPrice: integer("compare_at_price"),
    status: text("status").$type<"active" | "draft">().notNull().default("active"),
    isBestSeller: boolean("is_best_seller").notNull().default(false),
    position: integer("position").notNull().default(999),
    searchText: text("search_text").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("products_family_idx").on(t.family), index("products_status_idx").on(t.status)],
);

export const productImages = pgTable(
  "product_images",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    bg: text("bg").notNull().default("#F5F1E8"),
    accent: text("accent").notNull().default("#0B0B0C"),
    cutoutUrl: text("cutout_url"),
    cutoutW: integer("cutout_w"),
    cutoutH: integer("cutout_h"),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("product_images_product_idx").on(t.productId)],
);

export const variants = pgTable(
  "variants",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: text("sku").notNull(),
    optionValue: text("option_value"),
    price: integer("price").notNull(),
    compareAtPrice: integer("compare_at_price"),
    /** null = مخزون غير محدود */
    stock: integer("stock"),
    imageId: integer("image_id").references(() => productImages.id, { onDelete: "set null" }),
    position: integer("position").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [index("variants_product_idx").on(t.productId)],
);

export const productCategories = pgTable(
  "product_categories",
  {
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.productId, t.categoryId] })],
);

export const coupons = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  type: text("type").$type<"percent" | "fixed" | "free_shipping">().notNull(),
  /** percent: 1-100 ، fixed: بالهللة */
  value: integer("value").notNull().default(0),
  minSubtotal: integer("min_subtotal").notNull().default(0),
  maxDiscount: integer("max_discount"),
  usageLimit: integer("usage_limit"),
  usedCount: integer("used_count").notNull().default(0),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const shippingMethods = pgTable("shipping_methods", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  price: integer("price").notNull().default(0),
  freeAbove: integer("free_above"),
  isActive: boolean("is_active").notNull().default(true),
  position: integer("position").notNull().default(0),
});

export type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";
export type PaymentStatus = "unpaid" | "paid" | "failed" | "refunded";
export type PaymentMethod = "edfapay" | "cod";

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    number: text("number").notNull().unique(),
    accessToken: text("access_token").notNull(),
    customerId: integer("customer_id").references(() => customers.id, { onDelete: "set null" }),
    status: text("status").$type<OrderStatus>().notNull().default("pending"),
    paymentStatus: text("payment_status").$type<PaymentStatus>().notNull().default("unpaid"),
    paymentMethod: text("payment_method").$type<PaymentMethod>().notNull(),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    customerEmail: text("customer_email"),
    address: jsonb("address").$type<Address>().notNull(),
    subtotal: integer("subtotal").notNull(),
    discount: integer("discount").notNull().default(0),
    shipping: integer("shipping").notNull().default(0),
    codFee: integer("cod_fee").notNull().default(0),
    total: integer("total").notNull(),
    vatAmount: integer("vat_amount").notNull().default(0),
    couponCode: text("coupon_code"),
    shippingMethodName: text("shipping_method_name").notNull(),
    trackingCarrier: text("tracking_carrier"),
    trackingNumber: text("tracking_number"),
    trackingUrl: text("tracking_url"),
    gatewayTransactionId: text("gateway_transaction_id"),
    customerNote: text("customer_note"),
    adminNote: text("admin_note"),
    stockReleased: boolean("stock_released").notNull().default(false),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("orders_customer_idx").on(t.customerId),
    index("orders_status_idx").on(t.status),
    index("orders_created_idx").on(t.createdAt),
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
    variantId: integer("variant_id").references(() => variants.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    optionValue: text("option_value"),
    sku: text("sku").notNull(),
    imageUrl: text("image_url"),
    unitPrice: integer("unit_price").notNull(),
    qty: integer("qty").notNull(),
    total: integer("total").notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

export const orderEvents = pgTable(
  "order_events",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    note: text("note"),
    isPublic: boolean("is_public").notNull().default(true),
    actor: text("actor").notNull().default("system"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId)],
);

export const paymentAttempts = pgTable(
  "payment_attempts",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerRef: text("provider_ref"),
    status: text("status").notNull(),
    amount: integer("amount").notNull(),
    raw: jsonb("raw"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("payment_attempts_order_idx").on(t.orderId)],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

export const pages = pgTable("pages", {
  slug: text("slug").primaryKey(),
  title: text("title").notNull(),
  bodyHtml: text("body_html").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
});

/* ───────── relations ───────── */

export const productsRelations = relations(products, ({ many }) => ({
  images: many(productImages),
  variants: many(variants),
  categories: many(productCategories),
}));
export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, { fields: [productImages.productId], references: [products.id] }),
}));
export const variantsRelations = relations(variants, ({ one }) => ({
  product: one(products, { fields: [variants.productId], references: [products.id] }),
  image: one(productImages, { fields: [variants.imageId], references: [productImages.id] }),
}));
export const productCategoriesRelations = relations(productCategories, ({ one }) => ({
  product: one(products, { fields: [productCategories.productId], references: [products.id] }),
  category: one(categories, { fields: [productCategories.categoryId], references: [categories.id] }),
}));
export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(productCategories),
}));
export const ordersRelations = relations(orders, ({ many, one }) => ({
  items: many(orderItems),
  events: many(orderEvents),
  payments: many(paymentAttempts),
  customer: one(customers, { fields: [orders.customerId], references: [customers.id] }),
}));
export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
}));
export const orderEventsRelations = relations(orderEvents, ({ one }) => ({
  order: one(orders, { fields: [orderEvents.orderId], references: [orders.id] }),
}));
export const paymentAttemptsRelations = relations(paymentAttempts, ({ one }) => ({
  order: one(orders, { fields: [paymentAttempts.orderId], references: [orders.id] }),
}));
export const customersRelations = relations(customers, ({ many }) => ({
  orders: many(orders),
}));
