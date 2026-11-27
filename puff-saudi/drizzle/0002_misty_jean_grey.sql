ALTER TABLE "orders" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "attribution" jsonb;--> statement-breakpoint
CREATE INDEX "orders_source_idx" ON "orders" USING btree ("source");