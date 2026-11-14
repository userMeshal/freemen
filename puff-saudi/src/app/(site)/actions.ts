"use server";

import { z } from "zod";
import { quoteCart } from "@/lib/pricing";
import { searchProducts } from "@/lib/catalog";
import type { CartQuote, ProductCardDTO } from "@/lib/types";

const itemsSchema = z
  .array(z.object({ variantId: z.number().int().positive(), qty: z.number().int().min(1).max(99) }))
  .max(60);

const quoteSchema = z.object({
  items: itemsSchema,
  couponCode: z.string().trim().max(40).nullish(),
  shippingMethodId: z.number().int().positive().nullish(),
  paymentMethod: z.enum(["edfapay", "cod"]).nullish(),
});

export async function quoteCartAction(input: z.input<typeof quoteSchema>): Promise<CartQuote> {
  const parsed = quoteSchema.parse(input);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { couponRow, ...quote } = await quoteCart(parsed.items, parsed);
  return quote;
}

export async function searchAction(query: string): Promise<ProductCardDTO[]> {
  const q = z.string().trim().max(80).parse(query);
  if (q.length < 2) return [];
  return searchProducts(q, 8);
}
