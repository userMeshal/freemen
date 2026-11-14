"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { TLink, usePageTransition } from "./Transition";
import { QtyStepper } from "./CartDrawer";
import { SaleBadge } from "@/components/ui/Price";
import { SplitText } from "@/components/ui/Reveal";
import { useCart } from "@/store/cart";
import { pixel } from "@/lib/pixels";
import { formatAmount } from "@/lib/money";
import type { ProductDTO } from "@/lib/types";

const EASE = [0.16, 1, 0.3, 1] as const;

export type SiblingLink = { slug: string; label: string; accent?: string; active: boolean };

function Accordion({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-ink/15">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 py-5 text-start font-display text-base font-bold"
      >
        {title}
        <ChevronDown size={18} className={`shrink-0 transition-transform duration-500 ease-expo ${open ? "rotate-180" : ""}`} />
      </button>
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-500 ease-expo ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="pb-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function ProductView({
  product,
  familyName,
  familyKey,
  colorSiblings,
  sizeSiblings,
  initialVariantId,
}: {
  product: ProductDTO;
  familyName: string | null;
  familyKey: string | null;
  colorSiblings: SiblingLink[];
  sizeSiblings: SiblingLink[];
  initialVariantId: number | null;
}) {
  const { navigate } = usePageTransition();
  const add = useCart((s) => s.add);
  const openCart = useCart((s) => s.open);

  const firstAvailable = product.variants.find((v) => v.stock === null || v.stock > 0) ?? product.variants[0];
  const [variantId, setVariantId] = useState<number>(
    product.variants.some((v) => v.id === initialVariantId) ? initialVariantId! : firstAvailable.id,
  );
  const variant = product.variants.find((v) => v.id === variantId) ?? firstAvailable;
  const multi = product.variants.length > 1;

  const imageById = useMemo(() => new Map(product.images.map((i) => [i.id, i])), [product.images]);
  const variantImageIds = useMemo(() => new Set(product.variants.map((v) => v.imageId).filter(Boolean)), [product.variants]);
  // صور المعرض = الصور غير المرتبطة بمتغير معيّن (أو كل الصور إن لم يكن هناك ربط)
  const gallery = useMemo(() => {
    const free = product.images.filter((i) => !variantImageIds.has(i.id));
    return variantImageIds.size ? free : product.images;
  }, [product.images, variantImageIds]);

  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const variantImage = variant.imageId ? imageById.get(variant.imageId) : undefined;
  const image = (galleryIndex !== null ? gallery[galleryIndex] : undefined) ?? variantImage ?? product.images[0] ?? null;

  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const outOfStock = variant.stock !== null && variant.stock <= 0;
  const maxQty = variant.stock === null ? 20 : Math.min(20, variant.stock);
  const swatchMode = multi && product.variants.every((v) => v.imageId && imageById.get(v.imageId));

  const buyBtn = useRef<HTMLDivElement>(null);
  const [stickyBar, setStickyBar] = useState(false);

  useEffect(() => {
    pixel.viewContent({ id: product.id, name: product.name, price: product.price });
  }, [product.id, product.name, product.price]);

  useEffect(() => {
    const el = buyBtn.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setStickyBar(!e.isIntersecting && e.boundingClientRect.top < 0), {
      threshold: 0,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const pick = (id: number) => {
    setVariantId(id);
    setGalleryIndex(null);
    setQty(1);
    const q = new URLSearchParams(window.location.search);
    q.set("v", String(id));
    window.history.replaceState(null, "", `${window.location.pathname}?${q}`);
  };

  const addToCart = (thenCheckout = false) => {
    if (outOfStock) return;
    add(
      {
        variantId: variant.id,
        slug: product.slug,
        name: product.name,
        optionValue: variant.optionValue,
        imageUrl: (variantImage ?? product.images[0])?.url ?? null,
        bg: (variantImage ?? product.images[0])?.bg ?? "#F5F1E8",
        unitPrice: variant.price,
      },
      qty,
    );
    pixel.addToCart({ id: product.id, name: product.name, price: variant.price, qty });
    if (thenCheckout) {
      navigate("/checkout");
      return;
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
    setTimeout(openCart, 420);
  };

  const bg = image?.bg ?? "#EBE5D6";

  return (
    <>
      <section
        className="relative pt-[var(--header-h)] transition-[background-color] duration-[900ms] ease-expo"
        style={{ backgroundColor: bg }}
      >
        <div className="wrap grid gap-6 pb-10 pt-4 md:pt-8 lg:grid-cols-[1.08fr_1fr] lg:gap-14 lg:pb-20">
          {/* ───── المعرض ───── */}
          <div className="min-w-0 lg:sticky lg:top-[calc(var(--header-h)+1rem)] lg:self-start">
            <div className="relative mx-auto aspect-square w-full max-w-[46rem] overflow-hidden rounded-tile">
              <AnimatePresence mode="popLayout" initial={false}>
                {image && (
                  <motion.div
                    key={image.url}
                    className="absolute inset-0"
                    initial={{ opacity: 0, scale: 1.08, rotate: 2.5 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0, transition: { duration: 0.85, ease: EASE } }}
                    exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.3 } }}
                  >
                    <Image
                      src={image.url}
                      alt={`${product.name}${variant.optionValue ? ` — ${variant.optionValue}` : ""}`}
                      fill
                      priority
                      sizes="(min-width: 1024px) 50vw, 100vw"
                      className={image.flat ? "object-contain" : "object-cover"}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="pointer-events-none absolute inset-x-4 top-4 flex justify-between">
                <SaleBadge price={variant.price} compareAt={variant.compareAtPrice} className="!px-3 !py-1.5 !text-xs" />
                {product.isBestSeller && (
                  <span className="rounded-full bg-lime px-3 py-1.5 font-display text-[0.68rem] font-bold">الأكثر مبيعًا</span>
                )}
              </div>
            </div>

            {gallery.length > 1 && (
              <ul className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="صور المنتج">
                {gallery.map((g, i) => {
                  const active = image?.id === g.id;
                  return (
                    <li key={g.id} className="shrink-0">
                      <button
                        type="button"
                        onClick={() => setGalleryIndex(i)}
                        aria-label={`صورة ${i + 1}`}
                        aria-pressed={active}
                        className={`relative block h-[4.5rem] w-[4.5rem] overflow-hidden rounded-2xl border-2 transition-all duration-300 md:h-20 md:w-20 ${
                          active ? "border-ink" : "border-transparent opacity-70 hover:opacity-100"
                        }`}
                        style={{ backgroundColor: g.bg }}
                      >
                        <Image src={g.url} alt="" fill sizes="80px" className="object-cover" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* ───── معلومات الشراء ───── */}
          <div className="min-w-0 lg:py-6">
            <nav aria-label="مسار التنقل" className="mb-4 flex flex-wrap items-center gap-2 text-xs text-ink/60">
              <TLink href="/" className="link-draw">
                الرئيسية
              </TLink>
              <span aria-hidden>/</span>
              <TLink href="/shop" className="link-draw">
                المتجر
              </TLink>
              {familyName && familyKey && (
                <>
                  <span aria-hidden>/</span>
                  <TLink href={`/shop?family=${familyKey}`} className="link-draw">
                    {familyName}
                  </TLink>
                </>
              )}
            </nav>

            <SplitText as="h1" text={product.name.replace(" | ", "\n")} className="t-h2" immediate />

            <div className="mt-5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <div className="h-[3rem] overflow-hidden">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p
                    key={variant.price}
                    initial={{ y: "100%" }}
                    animate={{ y: 0, transition: { duration: 0.5, ease: EASE } }}
                    exit={{ y: "-100%", transition: { duration: 0.18 } }}
                    className="font-display text-[2.4rem] font-black leading-[3rem]"
                  >
                    <span className="num">{formatAmount(variant.price)}</span>{" "}
                    <span className="text-base font-semibold">ر.س</span>
                  </motion.p>
                </AnimatePresence>
              </div>
              {variant.compareAtPrice && variant.compareAtPrice > variant.price && (
                <s className="num text-lg text-ink/50">{formatAmount(variant.compareAtPrice)}</s>
              )}
              <span className="text-xs text-ink/60">شامل ضريبة القيمة المضافة</span>
            </div>

            {/* خيارات المنتج نفسه */}
            {multi && (
              <fieldset className="mt-8">
                <legend className="mb-3 flex items-baseline gap-2 text-sm">
                  <span className="font-semibold">{product.optionName ?? "الخيار"}:</span>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={variant.optionValue}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.2 }}
                      className="t-accent text-xl"
                    >
                      {variant.optionValue}
                    </motion.span>
                  </AnimatePresence>
                </legend>
                {swatchMode ? (
                  <div className="flex flex-wrap gap-2.5">
                    {product.variants.map((v) => {
                      const img = imageById.get(v.imageId!)!;
                      const active = v.id === variant.id;
                      const gone = v.stock !== null && v.stock <= 0;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          title={v.optionValue ?? ""}
                          aria-label={v.optionValue ?? ""}
                          aria-pressed={active}
                          onClick={() => pick(v.id)}
                          className={`relative h-11 w-11 rounded-full border border-ink/15 transition-transform duration-500 ease-expo hover:scale-110 ${
                            active ? "scale-110" : ""
                          } ${gone ? "opacity-35" : ""}`}
                          style={{ backgroundColor: img.accent }}
                        >
                          {active && (
                            <motion.span
                              layoutId="pv-ring"
                              className="absolute -inset-[5px] rounded-full border-2 border-ink"
                              transition={{ duration: 0.45, ease: EASE }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {product.variants.map((v) => {
                      const active = v.id === variant.id;
                      const gone = v.stock !== null && v.stock <= 0;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => pick(v.id)}
                          className={`relative rounded-full border-[1.5px] px-5 py-3 text-sm font-semibold transition-colors duration-300 ${
                            active ? "border-ink text-paper" : "border-ink/20 hover:border-ink"
                          } ${gone ? "opacity-40 line-through" : ""}`}
                        >
                          {active && (
                            <motion.span
                              layoutId="pv-pill"
                              className="absolute inset-0 rounded-full bg-ink"
                              transition={{ duration: 0.45, ease: EASE }}
                            />
                          )}
                          <span className="relative">{v.optionValue}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </fieldset>
            )}

            {/* ألوان أخرى (منتجات شقيقة) */}
            {colorSiblings.length > 1 && (
              <div className="mt-8">
                <p className="mb-3 text-sm">
                  <span className="font-semibold">اللون:</span>{" "}
                  <span className="t-accent text-xl">{product.colorName}</span>
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {colorSiblings.map((s) => (
                    <Link
                      key={s.slug}
                      href={`/p/${s.slug}`}
                      scroll={false}
                      title={s.label}
                      aria-label={s.label}
                      aria-current={s.active ? "true" : undefined}
                      className={`relative block h-10 w-10 rounded-full border border-ink/15 transition-transform duration-500 ease-expo hover:scale-110 ${
                        s.active ? "scale-110 ring-2 ring-ink ring-offset-[3px]" : ""
                      }`}
                      style={{ backgroundColor: s.accent, ["--tw-ring-offset-color" as string]: bg }}
                    />
                  ))}
                </div>
              </div>
            )}

            {sizeSiblings.length > 1 && (
              <div className="mt-7">
                <p className="mb-3 text-sm font-semibold">السعة</p>
                <div className="flex flex-wrap gap-2">
                  {sizeSiblings.map((s) => (
                    <Link
                      key={s.slug}
                      href={`/p/${s.slug}`}
                      scroll={false}
                      aria-current={s.active ? "true" : undefined}
                      className={`rounded-full border-[1.5px] px-5 py-3 text-sm font-semibold transition-colors duration-300 ${
                        s.active ? "border-ink bg-ink text-paper" : "border-ink/20 hover:border-ink"
                      }`}
                    >
                      {s.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* الكمية والشراء */}
            <div ref={buyBtn} className="mt-9 flex flex-wrap items-center gap-3">
              <QtyStepper qty={qty} onChange={(q) => setQty(Math.max(1, Math.min(maxQty, q)))} max={maxQty} />
              <button
                type="button"
                onClick={() => addToCart(false)}
                disabled={outOfStock}
                className="btn btn-ink !min-h-[3.6rem] flex-1 !text-base"
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={outOfStock ? "out" : added ? "added" : "add"}
                    initial={{ y: 18, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -18, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="flex items-center gap-2"
                  >
                    {outOfStock ? (
                      "نفدت الكمية"
                    ) : added ? (
                      <>
                        <Check size={19} strokeWidth={2.6} /> أُضيف إلى السلة
                      </>
                    ) : (
                      <>
                        أضف إلى السلة — <span className="num">{formatAmount(variant.price * qty)}</span> ر.س
                      </>
                    )}
                  </motion.span>
                </AnimatePresence>
              </button>
            </div>
            {!outOfStock && (
              <button type="button" onClick={() => addToCart(true)} className="btn btn-ghost mt-3 w-full">
                اشترِ الآن
              </button>
            )}
            {variant.stock !== null && variant.stock > 0 && variant.stock <= 5 && (
              <p className="mt-3 text-sm font-medium text-coral">
                بقي <span className="num">{variant.stock}</span> فقط
              </p>
            )}

            <ul className="mt-8 grid grid-cols-3 gap-2 text-center text-[0.72rem] leading-relaxed text-ink/75 md:text-xs">
              <li className="flex flex-col items-center gap-2 rounded-2xl bg-paper/55 px-2 py-4 backdrop-blur-sm">
                <Truck size={20} />
                توصيل داخل المملكة خلال 3–5 أيام عمل
              </li>
              <li className="flex flex-col items-center gap-2 rounded-2xl bg-paper/55 px-2 py-4 backdrop-blur-sm">
                <RotateCcw size={20} />
                استرجاع خلال 7 أيام من الاستلام
              </li>
              <li className="flex flex-col items-center gap-2 rounded-2xl bg-paper/55 px-2 py-4 backdrop-blur-sm">
                <ShieldCheck size={20} />
                دفع آمن: مدى، بطاقات، Apple Pay
              </li>
            </ul>

            <div className="mt-8 border-t border-ink/15">
              <Accordion title="الوصف والمواصفات" defaultOpen>
                <div className="prose-puff" dangerouslySetInnerHTML={{ __html: product.descriptionHtml }} />
                <p className="mt-3 text-xs text-ink/55">
                  رمز المنتج: <span className="num">{variant.sku}</span>
                </p>
              </Accordion>
              <Accordion title="الشحن والتوصيل">
                <p className="text-sm leading-loose text-ink/75">
                  نجهّز طلبك خلال 3 أيام من تأكيده، والتوصيل القياسي داخل المملكة من 3 إلى 5 أيام عمل بعد تسليم الشحنة للناقل.{" "}
                  <TLink href="/pages/shipping" className="link-draw font-semibold text-ink">
                    سياسة الشحن
                  </TLink>
                </p>
              </Accordion>
              <Accordion title="الاستبدال والاسترجاع">
                <p className="text-sm leading-loose text-ink/75">
                  يمكنك طلب الاسترجاع خلال 7 أيام من الاستلام ما دام المنتج بحالته الأصلية ولم يُستخدم.{" "}
                  <TLink href="/pages/returns" className="link-draw font-semibold text-ink">
                    سياسة الاسترداد
                  </TLink>
                </p>
              </Accordion>
            </div>
          </div>
        </div>
      </section>

      {/* شريط الشراء الثابت على الجوال */}
      <AnimatePresence>
        {stickyBar && !outOfStock && (
          <motion.div
            initial={{ y: "110%" }}
            animate={{ y: 0 }}
            exit={{ y: "110%" }}
            transition={{ duration: 0.55, ease: EASE }}
            className="pb-safe fixed inset-x-0 bottom-0 z-[80] border-t border-line bg-paper/92 px-4 pt-3 backdrop-blur-xl lg:hidden"
          >
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-ink-mute">{variant.optionValue ?? product.name}</p>
                <p className="font-display text-lg font-extrabold">
                  <span className="num">{formatAmount(variant.price)}</span> <span className="text-xs font-medium">ر.س</span>
                </p>
              </div>
              <button type="button" onClick={() => addToCart(false)} className="btn btn-ink shrink-0">
                {added ? "أُضيف ✓" : "أضف إلى السلة"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
