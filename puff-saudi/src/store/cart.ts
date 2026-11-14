"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItem = {
  variantId: number;
  qty: number;
  // بيانات للعرض الفوري فقط — الأسعار النهائية تُحسب دائمًا على الخادم
  slug: string;
  name: string;
  optionValue: string | null;
  imageUrl: string | null;
  bg: string;
  unitPrice: number;
};

type CartState = {
  items: CartItem[];
  coupon: string | null;
  isOpen: boolean;
  hydrated: boolean;
  add: (item: Omit<CartItem, "qty">, qty?: number) => void;
  setQty: (variantId: number, qty: number) => void;
  remove: (variantId: number) => void;
  clear: () => void;
  setCoupon: (code: string | null) => void;
  /** مزامنة العرض مع تسعير الخادم */
  sync: (lines: { variantId: number; qty: number; unitPrice: number }[]) => void;
  open: () => void;
  close: () => void;
};

const MAX = 20;

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      coupon: null,
      isOpen: false,
      hydrated: false,
      add: (item, qty = 1) =>
        set((s) => {
          const existing = s.items.find((i) => i.variantId === item.variantId);
          const items = existing
            ? s.items.map((i) => (i.variantId === item.variantId ? { ...i, ...item, qty: Math.min(MAX, i.qty + qty) } : i))
            : [...s.items, { ...item, qty: Math.min(MAX, qty) }];
          return { items };
        }),
      setQty: (variantId, qty) =>
        set((s) => ({
          items:
            qty <= 0
              ? s.items.filter((i) => i.variantId !== variantId)
              : s.items.map((i) => (i.variantId === variantId ? { ...i, qty: Math.min(MAX, qty) } : i)),
        })),
      remove: (variantId) => set((s) => ({ items: s.items.filter((i) => i.variantId !== variantId) })),
      clear: () => set({ items: [], coupon: null }),
      setCoupon: (coupon) => set({ coupon }),
      sync: (lines) =>
        set((s) => {
          const map = new Map(lines.map((l) => [l.variantId, l]));
          return {
            items: s.items
              .filter((i) => map.has(i.variantId))
              .map((i) => ({ ...i, qty: map.get(i.variantId)!.qty, unitPrice: map.get(i.variantId)!.unitPrice })),
          };
        }),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
    }),
    {
      name: "puff-cart-v1",
      partialize: (s) => ({ items: s.items, coupon: s.coupon }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);

export const cartCount = (items: CartItem[]) => items.reduce((n, i) => n + i.qty, 0);
export const cartSubtotal = (items: CartItem[]) => items.reduce((n, i) => n + i.qty * i.unitPrice, 0);
