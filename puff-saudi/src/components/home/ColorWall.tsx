"use client";

import Image from "next/image";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import { TLink } from "@/components/site/Transition";
import { Reveal, SplitText } from "@/components/ui/Reveal";
import { formatAmount } from "@/lib/money";

export type WallColor = { variantId: number; label: string; accent: string; bg: string; url: string; flat: boolean; price: number };
export type WallGroup = { slug: string; capacityMl: number; colors: WallColor[] };

const EASE = [0.16, 1, 0.3, 1] as const;

/** جدار الألوان: كل ألوان بف سيبي الحقيقية — المرور على اللون يبدّل الكوب ولون القسم كاملًا */
export function ColorWall({ groups }: { groups: WallGroup[] }) {
  const [g, setG] = useState(0);
  const [c, setC] = useState(0);
  const group = groups[g];
  const color = group?.colors[Math.min(c, (group?.colors.length ?? 1) - 1)];
  if (!group || !color) return null;

  const pickGroup = (i: number) => {
    // نحافظ على نفس اللون إن وُجد في السعة الجديدة
    const same = groups[i].colors.findIndex((x) => x.label === color.label);
    setG(i);
    setC(same >= 0 ? same : 0);
  };

  return (
    <section
      id="colors"
      className="relative overflow-hidden py-20 transition-[background-color] duration-[900ms] ease-expo md:py-32"
      style={{ backgroundColor: color.bg }}
    >
      <div className="wrap grid items-center gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
        {/* الكوب */}
        <div className="relative order-2 mx-auto aspect-square w-full max-w-[34rem] lg:order-1">
          <div
            aria-hidden
            className="absolute inset-[12%] rounded-full blur-3xl transition-[background-color] duration-[900ms]"
            style={{ backgroundColor: color.accent, opacity: 0.35 }}
          />
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={color.url}
              className="absolute inset-0"
              initial={{ opacity: 0, scale: 0.9, rotate: -6 }}
              animate={{ opacity: 1, scale: 1, rotate: 0, transition: { duration: 0.7, ease: EASE } }}
              exit={{ opacity: 0, scale: 1.06, rotate: 4, transition: { duration: 0.3 } }}
            >
              <Image
                src={color.url}
                alt={`بف سيبي ${color.label}`}
                fill
                sizes="(min-width:1024px) 40vw, 90vw"
                className="rounded-tile object-contain"
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* الاختيار */}
        <div className="order-1 lg:order-2">
          <Reveal as="p" className="t-eyebrow text-ink/60">
            بف سيبي — <span className="num">{group.colors.length}</span> لونًا
          </Reveal>
          <SplitText as="h2" className="t-h1 mt-3" text={"اختر\nلونك."} accentWords={["لونك"]} />

          <div className="mt-6 h-[4.2rem] overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={color.label}
                initial={{ y: "100%" }}
                animate={{ y: 0, transition: { duration: 0.55, ease: EASE } }}
                exit={{ y: "-100%", transition: { duration: 0.22 } }}
                className="t-accent text-[clamp(2rem,4.4vw,3.4rem)] leading-[1.25]"
              >
                {color.label}
              </motion.p>
            </AnimatePresence>
          </div>

          {/* السعة */}
          <div className="mt-5 inline-flex rounded-full bg-ink/10 p-1" role="tablist" aria-label="السعة">
            {groups.map((gr, i) => (
              <button
                key={gr.slug}
                type="button"
                role="tab"
                aria-selected={i === g}
                onClick={() => pickGroup(i)}
                className="relative rounded-full px-4 py-2 font-display text-sm font-bold"
              >
                {i === g && (
                  <motion.span
                    layoutId="wall-cap"
                    className="absolute inset-0 rounded-full bg-ink"
                    transition={{ duration: 0.5, ease: EASE }}
                  />
                )}
                <span className={`relative transition-colors duration-300 ${i === g ? "text-paper" : ""}`}>
                  <span className="num">{gr.capacityMl}</span> مل
                </span>
              </button>
            ))}
          </div>

          {/* العينات */}
          <ul className="mt-6 flex max-w-xl flex-wrap gap-2.5" aria-label="الألوان">
            {group.colors.map((col, i) => (
              <li key={col.variantId}>
                <button
                  type="button"
                  title={col.label}
                  aria-label={col.label}
                  aria-pressed={i === c}
                  onMouseEnter={() => setC(i)}
                  onFocus={() => setC(i)}
                  onClick={() => setC(i)}
                  className={`relative block h-10 w-10 rounded-full border border-ink/15 transition-transform duration-500 ease-expo hover:scale-110 md:h-11 md:w-11 ${
                    i === c ? "scale-110" : ""
                  }`}
                  style={{ backgroundColor: col.accent }}
                >
                  {i === c && (
                    <motion.span
                      layoutId="wall-ring"
                      className="absolute -inset-[5px] rounded-full border-2 border-ink"
                      transition={{ duration: 0.45, ease: EASE }}
                    />
                  )}
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-9 flex flex-wrap items-center gap-5">
            <TLink href={`/p/${group.slug}?v=${color.variantId}`} className="btn btn-ink">
              تسوّق هذا اللون
              <ArrowLeft size={17} />
            </TLink>
            <span className="font-display text-xl font-extrabold">
              <span className="num">{formatAmount(color.price)}</span> <span className="text-sm font-medium">ر.س</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
