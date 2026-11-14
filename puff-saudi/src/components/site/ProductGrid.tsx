"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { ProductCard } from "./ProductCard";
import type { ProductCardDTO } from "@/lib/types";

type SortKey = "featured" | "price-asc" | "price-desc" | "newest";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "featured", label: "المقترح" },
  { key: "newest", label: "الأحدث" },
  { key: "price-asc", label: "السعر: الأقل أولًا" },
  { key: "price-desc", label: "السعر: الأعلى أولًا" },
];

export type FamilyFilter = { key: string; name: string; members: string[] };

const EASE = [0.16, 1, 0.3, 1] as const;
const PAGE = 24;

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`relative shrink-0 rounded-full border-[1.5px] px-4 py-2 text-sm font-medium transition-colors duration-300 ${
        active ? "border-ink bg-ink text-paper" : "border-ink/15 hover:border-ink"
      }`}
    >
      {children}
    </button>
  );
}

/** شبكة المنتجات مع فلاتر فورية (بدون إعادة تحميل) — تُحفظ الفلاتر في رابط الصفحة */
export function ProductGrid({
  products,
  families,
  initialFamily = null,
  showFamilyFilter = true,
}: {
  products: ProductCardDTO[];
  families: FamilyFilter[];
  initialFamily?: string | null;
  showFamilyFilter?: boolean;
}) {
  const [family, setFamily] = useState<string | null>(initialFamily);
  const [capacity, setCapacity] = useState<number | null>(null);
  const [onlyGroups, setOnlyGroups] = useState(false);
  const [sort, setSort] = useState<SortKey>("featured");
  const [visible, setVisible] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);

  // قراءة الفلاتر من الرابط عند التحميل (روابط المشاركة والرجوع للخلف)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const f = q.get("family");
    if (f && families.some((x) => x.key === f)) setFamily(f);
    const c = Number(q.get("size"));
    if (c) setCapacity(c);
    const s = q.get("sort") as SortKey | null;
    if (s && SORTS.some((x) => x.key === s)) setSort(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const set = (k: string, v: string | null) => (v ? q.set(k, v) : q.delete(k));
    if (showFamilyFilter) set("family", family);
    set("size", capacity ? String(capacity) : null);
    set("sort", sort === "featured" ? null : sort);
    const qs = q.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    setVisible(PAGE);
  }, [family, capacity, sort, showFamilyFilter]);

  const inFamily = useMemo(() => {
    const members = families.find((f) => f.key === family)?.members;
    return members ? products.filter((p) => members.includes(p.family)) : products;
  }, [products, families, family]);

  const capacities = useMemo(
    () => [...new Set(inFamily.map((p) => p.capacityMl).filter((c): c is number => Boolean(c)))].sort((a, b) => a - b),
    [inFamily],
  );

  const filtered = useMemo(() => {
    let list = inFamily;
    if (capacity) list = list.filter((p) => p.capacityMl === capacity);
    if (onlyGroups) list = list.filter((p) => p.variantCount > 1);
    const out = [...list];
    if (sort === "price-asc") out.sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") out.sort((a, b) => b.price - a.price);
    else if (sort === "newest") out.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
    else {
      // المقترح: الإصدارات الخاصة، ثم المجموعات متعددة الألوان، ثم الأكثر مبيعًا، ثم البقية بترتيب المتجر
      const rank = (p: ProductCardDTO) => (p.family === "special" ? 0 : p.variantCount > 1 ? 1 : p.isBestSeller ? 2 : 3);
      out.sort((a, b) => rank(a) - rank(b) || a.position - b.position || a.id - b.id);
    }
    return out;
  }, [inFamily, capacity, onlyGroups, sort]);

  // تحميل تدريجي عند الاقتراب من نهاية الشبكة
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (e) => e[0].isIntersecting && setVisible((v) => Math.min(filtered.length, v + PAGE)),
      { rootMargin: "900px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [filtered.length]);

  const hasFilters = Boolean((showFamilyFilter && family) || capacity || onlyGroups);
  const gridKey = `${family}-${capacity}-${onlyGroups}-${sort}`;

  return (
    <div>
      {/* شريط الفلاتر */}
      <div className="sticky top-0 z-30 -mx-[var(--gutter)] border-y border-line bg-paper/85 px-[var(--gutter)] backdrop-blur-xl">
        <div className="flex items-center gap-3 py-3">
          <SlidersHorizontal size={18} className="hidden shrink-0 text-ink-mute sm:block" />
          <div className="no-scrollbar -mx-1 flex flex-1 items-center gap-2 overflow-x-auto px-1">
            {showFamilyFilter && (
              <>
                <Chip active={!family} onClick={() => setFamily(null)}>
                  الكل
                </Chip>
                {families.map((f) => (
                  <Chip
                    key={f.key}
                    active={family === f.key}
                    onClick={() => {
                      setFamily(family === f.key ? null : f.key);
                      setCapacity(null);
                    }}
                  >
                    {f.name}
                  </Chip>
                ))}
                {capacities.length > 1 && <span className="mx-1 h-5 w-px shrink-0 bg-ink/15" />}
              </>
            )}
            {capacities.length > 1 &&
              capacities.map((c) => (
                <Chip key={c} active={capacity === c} onClick={() => setCapacity(capacity === c ? null : c)}>
                  <span className="num">{c}</span> مل
                </Chip>
              ))}
            <span className="mx-1 h-5 w-px shrink-0 bg-ink/15" />
            <Chip active={onlyGroups} onClick={() => setOnlyGroups(!onlyGroups)}>
              متعدد الألوان
            </Chip>
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  if (showFamilyFilter) setFamily(null);
                  setCapacity(null);
                  setOnlyGroups(false);
                }}
                className="flex shrink-0 items-center gap-1 px-2 text-sm text-ink-mute hover:text-ink"
              >
                <X size={14} /> مسح
              </button>
            )}
          </div>
          <label className="relative shrink-0">
            <span className="sr-only">الترتيب</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-10 cursor-pointer appearance-none rounded-full border-[1.5px] border-ink/15 bg-transparent pe-9 ps-4 !text-sm font-medium outline-none transition-colors hover:border-ink focus:border-ink"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <ChevronDown size={15} className="pointer-events-none absolute end-3.5 top-1/2 -translate-y-1/2" />
          </label>
        </div>
      </div>

      <p className="mt-5 text-sm text-ink-mute" aria-live="polite">
        <span className="num font-display font-bold text-ink">{filtered.length}</span> منتج
      </p>

      {filtered.length === 0 ? (
        <div className="py-24 text-center">
          <p className="t-h3">لا توجد منتجات بهذه الفلاتر</p>
          <p className="mt-2 text-ink-mute">جرّب إزالة أحد الفلاتر.</p>
        </div>
      ) : (
        <ul key={gridKey} className="mt-5 grid grid-cols-2 gap-x-3 gap-y-9 md:grid-cols-3 md:gap-x-5 md:gap-y-12 xl:grid-cols-4">
          {filtered.slice(0, visible).map((p, i) => (
            <motion.li
              key={p.id}
              initial={{ opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: EASE, delay: Math.min(i % PAGE, 11) * 0.045 }}
            >
              <ProductCard product={p} priority={i < 4} />
            </motion.li>
          ))}
        </ul>
      )}
      <div ref={sentinel} className="h-px" />
    </div>
  );
}
