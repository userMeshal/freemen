"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { CategoryDTO, ProductCardDTO } from "@/lib/types";
import { useStore } from "./ctx";
import { ProductCard } from "./ProductCard";
import { PageTitle, useT } from "./ui";

const SORTS = [
  { id: "default", label: "ترتيب المتجر" },
  { id: "low", label: "السعر: الأقل أولًا" },
  { id: "high", label: "السعر: الأعلى أولًا" },
] as const;

const fold = (s: string) => s.toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[ً-ْ]/g, "");

export function ShopView({ products, categories, initialCat, focusSearch }: { products: ProductCardDTO[]; categories: CategoryDTO[]; initialCat: string | null; focusSearch: boolean }) {
  const { store } = useStore();
  const t = useT();
  const soft = store.theme === "soft";
  const [cat, setCat] = useState<string | null>(initialCat);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<(typeof SORTS)[number]["id"]>("default");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => setCat(initialCat), [initialCat]);
  useEffect(() => {
    if (focusSearch) input.current?.focus();
  }, [focusSearch]);

  const list = useMemo(() => {
    const catId = categories.find((c) => c.slug === cat)?.id;
    const needle = fold(q.trim());
    let out = products.filter((p) => (!catId || p.categoryId === catId) && (!needle || fold(p.name).includes(needle)));
    if (sort === "low") out = [...out].sort((a, b) => a.price - b.price);
    if (sort === "high") out = [...out].sort((a, b) => b.price - a.price);
    return out;
  }, [products, categories, cat, q, sort]);

  const chip = (on: boolean) => (on ? t.chipOn : t.chip);

  return (
    <div className={t.page}>
      <PageTitle eyebrow={store.name} title={categories.find((c) => c.slug === cat)?.name ?? "كل المنتجات"} />

      <div className="mb-4 flex flex-col gap-3 md:flex-row">
        <label className={soft ? "s-search" : "flex h-14 flex-1 items-center gap-3 rounded-full border-[1.5px] border-ink/15 bg-paper-card px-5 focus-within:border-ink"}>
          <Search size={18} className="shrink-0 opacity-50" />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن منتج…" aria-label="بحث" className="min-w-0 flex-1 bg-transparent outline-none" />
        </label>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="الترتيب" className={soft ? "s-select md:!w-56 !rounded-full" : "h-14 rounded-full border-[1.5px] border-ink/15 bg-paper-card px-5 md:w-56"}>
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {categories.length > 1 && (
        <div className="no-scrollbar -mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-1">
          <button type="button" className={`${chip(!cat)} shrink-0`} onClick={() => setCat(null)}>
            الكل <span className="num text-xs opacity-60">{products.length}</span>
          </button>
          {categories.map((c) => (
            <button key={c.id} type="button" className={`${chip(cat === c.slug)} shrink-0`} onClick={() => setCat(c.slug)}>
              {c.name} <span className="num text-xs opacity-60">{c.count}</span>
            </button>
          ))}
        </div>
      )}

      {list.length === 0 ? (
        <div className="py-20 text-center">
          <p className="font-display text-xl font-bold">ما لقينا شي يطابق بحثك</p>
          <p className={`mt-2 text-sm ${t.muted}`}>جرّب كلمة ثانية أو تصنيف آخر.</p>
        </div>
      ) : soft ? (
        <div className="s-grid">
          {list.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-9 md:grid-cols-3 md:gap-x-6 md:gap-y-14 xl:grid-cols-4">
          {list.map((p) => (
            <li key={p.id}>
              <ProductCard product={p} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
