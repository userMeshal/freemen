CREATE TABLE "abandoned_carts" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" integer NOT NULL,
	"phone" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"items" jsonb NOT NULL,
	"total" integer NOT NULL,
	"recovered" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" integer NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"icon" text DEFAULT 'Sparkles' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" integer NOT NULL,
	"order_id" integer NOT NULL,
	"reason" text NOT NULL,
	"details" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"merchant_reply" text DEFAULT '' NOT NULL,
	"resolution" text DEFAULT '' NOT NULL,
	"amount" integer NOT NULL,
	"refund_state" text DEFAULT 'none' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"replied_at" timestamp with time zone,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "counters" (
	"key" text PRIMARY KEY NOT NULL,
	"value" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" integer NOT NULL,
	"code" text NOT NULL,
	"type" text NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	"min_subtotal" integer DEFAULT 0 NOT NULL,
	"max_uses" integer,
	"used" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" integer NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"orders_count" integer DEFAULT 0 NOT NULL,
	"total_spent" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_order_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "daily_stats" (
	"store_id" integer NOT NULL,
	"day" date NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"product_views" integer DEFAULT 0 NOT NULL,
	"add_to_cart" integer DEFAULT 0 NOT NULL,
	"checkouts" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "daily_stats_store_id_day_pk" PRIMARY KEY("store_id","day")
);
--> statement-breakpoint
CREATE TABLE "ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" integer NOT NULL,
	"order_id" integer,
	"type" text NOT NULL,
	"amount" integer NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"payout_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"product_id" integer,
	"name" text NOT NULL,
	"option_value" text,
	"unit_price" integer NOT NULL,
	"qty" integer NOT NULL,
	"image" text,
	"art" jsonb
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" integer NOT NULL,
	"customer_id" integer,
	"number" text NOT NULL,
	"token" text NOT NULL,
	"status" text DEFAULT 'pending_payment' NOT NULL,
	"payment_method" text NOT NULL,
	"payment_status" text DEFAULT 'unpaid' NOT NULL,
	"gateway" text DEFAULT '' NOT NULL,
	"payment_ref" text,
	"gateway_payment_id" text,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"customer_email" text DEFAULT '' NOT NULL,
	"city" text NOT NULL,
	"address" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"subtotal" integer NOT NULL,
	"discount" integer DEFAULT 0 NOT NULL,
	"shipping" integer DEFAULT 0 NOT NULL,
	"total" integer NOT NULL,
	"vat" integer DEFAULT 0 NOT NULL,
	"coupon_code" text,
	"platform_fee" integer DEFAULT 0 NOT NULL,
	"net" integer DEFAULT 0 NOT NULL,
	"shipping_company" text DEFAULT '' NOT NULL,
	"tracking_number" text DEFAULT '' NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"paid_at" timestamp with time zone,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"day" date NOT NULL,
	"iban" text DEFAULT '' NOT NULL,
	"bank_holder" text DEFAULT '' NOT NULL,
	"bank_name" text DEFAULT '' NOT NULL,
	"reference" text DEFAULT '' NOT NULL,
	"orders_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" integer NOT NULL,
	"category_id" integer,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price" integer NOT NULL,
	"compare_at_price" integer,
	"stock" integer,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"art" jsonb NOT NULL,
	"option" jsonb,
	"is_featured" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"sold" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"order_id" integer NOT NULL,
	"name" text NOT NULL,
	"rating" integer NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" serial PRIMARY KEY NOT NULL,
	"merchant_id" integer,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"name_latin" text DEFAULT '' NOT NULL,
	"tagline" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"vertical" text DEFAULT 'general' NOT NULL,
	"theme" text DEFAULT 'bold' NOT NULL,
	"palette" jsonb NOT NULL,
	"content" jsonb NOT NULL,
	"settings" jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"claim_token" text,
	"idea" text DEFAULT '' NOT NULL,
	"bank_holder" text DEFAULT '' NOT NULL,
	"bank_name" text DEFAULT '' NOT NULL,
	"iban" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "abandoned_carts" ADD CONSTRAINT "abandoned_carts_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_stats" ADD CONSTRAINT "daily_stats_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "abandoned_store_phone_uq" ON "abandoned_carts" USING btree ("store_id","phone");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_store_slug_uq" ON "categories" USING btree ("store_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "claims_order_uq" ON "claims" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "claims_store_idx" ON "claims" USING btree ("store_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "coupons_store_code_uq" ON "coupons" USING btree ("store_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_store_phone_uq" ON "customers" USING btree ("store_id","phone");--> statement-breakpoint
CREATE INDEX "ledger_store_idx" ON "ledger" USING btree ("store_id","payout_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_order_type_uq" ON "ledger" USING btree ("order_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "merchants_phone_uq" ON "merchants" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_number_uq" ON "orders" USING btree ("number");--> statement-breakpoint
CREATE INDEX "orders_store_idx" ON "orders" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_payment_ref_idx" ON "orders" USING btree ("payment_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "payouts_store_day_uq" ON "payouts" USING btree ("store_id","day");--> statement-breakpoint
CREATE INDEX "payouts_status_idx" ON "payouts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "products_store_slug_uq" ON "products" USING btree ("store_id","slug");--> statement-breakpoint
CREATE INDEX "products_store_idx" ON "products" USING btree ("store_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_order_product_uq" ON "reviews" USING btree ("order_id","product_id");--> statement-breakpoint
CREATE INDEX "reviews_product_idx" ON "reviews" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stores_slug_uq" ON "stores" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "stores_merchant_idx" ON "stores" USING btree ("merchant_id");