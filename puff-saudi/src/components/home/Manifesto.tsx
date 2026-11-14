"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { CountUp, Reveal } from "@/components/ui/Reveal";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const TEXT =
  "نصنع أكوابًا تحفظ مشروبك كما تحبه؛ باردًا لساعات أو ساخنًا حتى آخر رشفة. ستانلس ستيل بعزل مزدوج، خالٍ من BPA، وبألوان اختيرت لتشبه مزاجك.";
const ACCENT = new Set(["باردًا", "ساخنًا", "مزاجك."]);

/** المواصفات مأخوذة من أوصاف المنتجات في المتجر */
const STATS: { to: number; unit: string; label: string; note: string }[] = [
  { to: 7, unit: "ساعات", label: "برودة", note: "بف سيبي" },
  { to: 20, unit: "ساعة", label: "احتفاظ بالثلج", note: "بف سيبي" },
  { to: 12, unit: "ساعة", label: "حرارة", note: "بف كوفي" },
  { to: 24, unit: "ساعة", label: "برودة للصغار", note: "بف فليبي ستانلس" },
];

export function Manifesto() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      // الكلمات تمتلئ بالضوء مع التمرير
      gsap.fromTo(
        ".mf-word",
        { opacity: 0.14 },
        {
          opacity: 1,
          ease: "none",
          stagger: 0.08,
          scrollTrigger: { trigger: ".mf-text", start: "top 82%", end: "bottom 45%", scrub: 0.5 },
        },
      );
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      className="on-ink relative z-10 -mt-10 rounded-t-[2.2rem] bg-ink py-24 text-paper md:-mt-14 md:rounded-t-[3.5rem] md:py-40"
    >
      <div className="wrap">
        <Reveal as="p" className="t-eyebrow mb-8 text-lime md:mb-12">
          لماذا بف؟
        </Reveal>
        <p className="mf-text max-w-[22ch] font-display text-[clamp(1.7rem,5.2vw,5rem)] font-extrabold leading-[1.45] md:max-w-[26ch] md:leading-[1.32]">
          {TEXT.split(" ").map((w, i) => (
            <span key={i} className={`mf-word inline-block ${ACCENT.has(w) ? "t-accent font-normal text-lime" : ""}`}>
              {w}
              {" "}
            </span>
          ))}
        </p>

        <dl className="mt-20 grid grid-cols-2 gap-x-6 gap-y-12 border-t border-paper/15 pt-12 md:mt-32 md:grid-cols-4 md:pt-16">
          {STATS.map((s, i) => (
            <Reveal key={s.label} index={i} className="flex flex-col">
              <dd className="order-1 flex items-baseline gap-2">
                <CountUp to={s.to} className="t-mega text-[clamp(3.6rem,9vw,8.5rem)] text-lime" />
                <span className="font-display text-sm font-semibold text-paper/70 md:text-lg">{s.unit}</span>
              </dd>
              <dt className="order-2 mt-3 font-display text-base font-bold md:text-xl">{s.label}</dt>
              <span className="order-3 mt-1 text-xs text-paper/50">{s.note} — بحسب مواصفات المنتج</span>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}
