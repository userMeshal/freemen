"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Search, X } from "lucide-react";
import { TLink, usePageTransition } from "./Transition";
import { lockScroll } from "./SmoothScroll";
import { useUI } from "@/store/ui";
import { searchAction } from "@/app/(site)/actions";
import { formatAmount } from "@/lib/money";
import type { ProductCardDTO } from "@/lib/types";

const EASE = [0.16, 1, 0.3, 1] as const;
const SUGGESTIONS = ["سيبي", "كوفي", "فليبي", "كروم", "مطفي", "550 مل"];

export function SearchOverlay() {
  const open = useUI((s) => s.searchOpen);
  const setSearch = useUI((s) => s.setSearch);
  const { navigate } = usePageTransition();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ProductCardDTO[]>([]);
  const [searched, setSearched] = useState(false);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    lockScroll(open);
    if (!open) return;
    const t = setTimeout(() => input.current?.focus(), 250);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSearch(false);
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      lockScroll(false);
    };
  }, [open, setSearch]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    const id = ++seq.current;
    const t = setTimeout(() => {
      start(async () => {
        const r = await searchAction(term).catch(() => []);
        if (id === seq.current) {
          setResults(r);
          setSearched(true);
        }
      });
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const submit = (term: string) => {
    const t = term.trim();
    if (!t) return;
    setSearch(false);
    navigate(`/search?q=${encodeURIComponent(t)}`);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="البحث"
          className="fixed inset-0 z-[110] flex flex-col bg-paper"
          initial={{ clipPath: "inset(0 0 100% 0)" }}
          animate={{ clipPath: "inset(0 0 0% 0)" }}
          exit={{ clipPath: "inset(0 0 100% 0)" }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <div className="wrap flex h-[var(--header-h)] shrink-0 items-center justify-between">
            <span className="t-eyebrow text-ink-mute">البحث</span>
            <button
              type="button"
              aria-label="إغلاق البحث"
              onClick={() => setSearch(false)}
              className="-me-2 grid h-11 w-11 place-items-center rounded-full bg-ink/5 transition-all duration-500 ease-expo hover:rotate-90 hover:bg-ink hover:text-paper"
            >
              <X size={20} />
            </button>
          </div>

          <div className="wrap flex-1 overflow-y-auto pb-10" data-lenis-prevent>
            <form
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                submit(q);
              }}
              className="flex items-center gap-3 border-b-2 border-ink pb-3 pt-4 md:pt-10"
            >
              <Search className="shrink-0" size={28} />
              <input
                ref={input}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                type="search"
                enterKeyHint="search"
                autoComplete="off"
                placeholder="عن ماذا تبحث؟"
                aria-label="ابحث في المتجر"
                className="w-full bg-transparent font-display text-[clamp(1.6rem,5vw,3.6rem)] font-extrabold outline-none placeholder:text-ink/20 [&::-webkit-search-cancel-button]:hidden"
              />
              <button type="submit" aria-label="ابحث" className="btn btn-ink !min-h-12 shrink-0 !px-4">
                <ArrowLeft size={20} />
              </button>
            </form>

            {q.trim().length < 2 ? (
              <div className="mt-8 flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setQ(s)}
                    className="rounded-full border-[1.5px] border-ink/15 px-4 py-2 text-sm transition-colors hover:border-ink hover:bg-ink hover:text-paper"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : (
              <div className={`mt-8 transition-opacity ${pending ? "opacity-50" : ""}`}>
                {searched && results.length === 0 ? (
                  <p className="text-ink-mute">لا توجد نتائج مطابقة لـ «{q.trim()}». جرّب كلمة أخرى.</p>
                ) : (
                  <>
                    <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
                      {results.map((p, i) => (
                        <motion.li
                          key={p.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, ease: EASE, delay: i * 0.04 }}
                        >
                          <TLink href={`/p/${p.slug}`} onClick={() => setSearch(false)} className="group block">
                            <div
                              className="relative aspect-square overflow-hidden rounded-3xl"
                              style={{ backgroundColor: p.image?.bg ?? "#EBE5D6" }}
                            >
                              {p.image && (
                                <Image
                                  src={p.image.url}
                                  alt={p.name}
                                  fill
                                  sizes="(min-width:768px) 25vw, 50vw"
                                  className="object-contain transition-transform duration-700 ease-expo group-hover:scale-110"
                                />
                              )}
                            </div>
                            <p className="mt-2 line-clamp-1 text-sm font-medium">{p.name}</p>
                            <p className="font-display text-sm font-bold">
                              <span className="num">{formatAmount(p.price)}</span> <span className="text-xs font-medium">ر.س</span>
                            </p>
                          </TLink>
                        </motion.li>
                      ))}
                    </ul>
                    {results.length > 0 && (
                      <button type="button" onClick={() => submit(q)} className="link-draw mt-8 font-display font-bold">
                        عرض كل النتائج ←
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
