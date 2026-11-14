"use client";

import { create } from "zustand";
import type { CartLine } from "@/lib/types";

type CartState = {
  slug: string;
  items: CartLine[];
  hydrated: boolean;
  isOpen: boolean;
  init: (slug: string) => void;
  add: (line: Omit<CartLine, "qty">, qty?: number) => void;
  setQty: (productId: number, optionValue: string | null, qty: number) => void;
  remove: (productId: number, optionValue: string | null) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
};

const key = (slug: string) => `zaar-cart:${slug}`;
const same = (a: CartLine, id: number, opt: string | null) => a.productId === id && a.optionValue === opt;

function save(slug: string, items: CartLine[]) {
  try {
    localStorage.setItem(key(slug), JSON.stringify(items));
  } catch {}
}

/** سلة لكل متجر، محفوظة في المتصفح. الأسعار النهائية تُحسب على الخادم عند الدفع. */
export const useCart = create<CartState>((set, get) => ({
  slug: "",
  items: [],
  hydrated: false,
  isOpen: false,
  init: (slug) => {
    if (get().slug === slug && get().hydrated) return;
    let items: CartLine[] = [];
    try {
      const raw = JSON.parse(localStorage.getItem(key(slug)) ?? "[]");
      if (Array.isArray(raw)) items = raw.filter((l) => l && typeof l.productId === "number" && typeof l.qty === "number").slice(0, 40);
    } catch {}
    set({ slug, items, hydrated: true });
  },
  add: (line, qty = 1) => {
    const { items, slug } = get();
    const hit = items.find((i) => same(i, line.productId, line.optionValue));
    const next = hit
      ? items.map((i) => (i === hit ? { ...i, ...line, qty: Math.min(20, i.qty + qty) } : i))
      : [...items, { ...line, qty: Math.min(20, qty) }];
    save(slug, next);
    set({ items: next });
  },
  setQty: (id, opt, qty) => {
    const { items, slug } = get();
    const next = qty <= 0 ? items.filter((i) => !same(i, id, opt)) : items.map((i) => (same(i, id, opt) ? { ...i, qty: Math.min(20, qty) } : i));
    save(slug, next);
    set({ items: next });
  },
  remove: (id, opt) => get().setQty(id, opt, 0),
  clear: () => {
    save(get().slug, []);
    set({ items: [] });
  },
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));

export const cartCount = (items: CartLine[]) => items.reduce((s, i) => s + i.qty, 0);
export const cartSubtotal = (items: CartLine[]) => items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
