"use client";

import Image from "next/image";
import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ArrowLeft } from "lucide-react";
import { TLink } from "@/components/site/Transition";
import { formatAmount } from "@/lib/money";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export type FamilyPanel = {
  key: string;
  name: string;
  latin: string;
  line: string;
  blurb: string;
  count: number;
  fromPrice: number;
  bg: string;
  specs: { value: string; unit: string; label: string }[];
  cups: { url: string; w: number; h: number; alt: string }[];
};

/**
 * العائلات: على سطح المكتب تتحول حركة التمرير العمودي إلى رحلة أفقية بين اللوحات،
 * وعلى الجوال شريط أفقي يُسحب باللمس (scroll-snap) — أخف وأسرع.
 */
export function Families({ panels }: { panels: FamilyPanel[] }) {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
        const el = track.current!;
        const distance = () => el.scrollWidth - window.innerWidth;
        // الصفحة RTL: اللوحة الأولى على اليمين، فنحرّك الشريط نحو اليمين (قيمة موجبة)
        const tween = gsap.to(el, {
          x: () => distance(),
          ease: "none",
          scrollTrigger: {
            trigger: root.current,
            start: "top top",
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 0.8,
            invalidateOnRefresh: true,
            anticipatePin: 1,
          },
        });
        gsap.utils.toArray<HTMLElement>(".fam-panel").forEach((panel) => {
          gsap.fromTo(
            panel.querySelectorAll(".fam-cup"),
            { yPercent: 18, rotate: (i) => (i % 2 ? 6 : -6) },
            {
              yPercent: 0,
              rotate: 0,
              ease: "none",
              stagger: 0.1,
              scrollTrigger: { trigger: panel, containerAnimation: tween, start: "right 20%", end: "left 80%", scrub: true },
            },
          );
          gsap.fromTo(
            panel.querySelector(".fam-latin"),
            { xPercent: -14 },
            {
              xPercent: 14,
              ease: "none",
              scrollTrigger: { trigger: panel, containerAnimation: tween, start: "right left", end: "left right", scrub: true },
            },
          );
        });
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} aria-label="عائلات بف" className="relative overflow-hidden bg-paper">
      <div
        ref={track}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto will-change-transform lg:h-[100svh] lg:w-max lg:snap-none lg:overflow-visible"
      >
        {/* لوحة العنوان */}
        <div className="flex w-[78vw] shrink-0 snap-start flex-col justify-end px-[var(--gutter)] py-14 lg:w-[38vw] lg:justify-center lg:py-0">
          <p className="t-eyebrow text-ink-mute">العائلات</p>
          <h2 className="t-h1 mt-4">
            ثلاث
            <br />
            <span className="t-accent font-normal">عائلات.</span>
            <br />
            مزاج واحد.
          </h2>
          <p className="mt-6 flex items-center gap-2 text-sm text-ink-mute">
            <span className="lg:hidden">اسحب</span>
            <span className="hidden lg:inline">واصل التمرير</span>
            <ArrowLeft size={16} className="motion-safe:animate-pulse" />
          </p>
        </div>

        {panels.map((p, idx) => (
          <article
            key={p.key}
            className="fam-panel relative flex w-[88vw] shrink-0 snap-center flex-col overflow-hidden p-2 lg:h-full lg:w-[74vw] lg:p-5"
          >
            <div
              className="relative flex h-full min-h-[34rem] flex-col justify-between overflow-hidden rounded-tile p-6 md:p-10 lg:min-h-0"
              style={{ backgroundColor: p.bg }}
            >
              <div
                aria-hidden
                dir="ltr"
                className="fam-latin t-mega t-outline pointer-events-none absolute inset-x-0 top-[6%] select-none whitespace-nowrap text-center text-[30vw] opacity-60 lg:text-[19vw]"
                style={{ ["--stroke" as string]: "rgba(11,11,12,.32)" }}
              >
                {p.latin}
              </div>

              <header className="relative flex items-start justify-between">
                <span className="num t-eyebrow rounded-full bg-ink px-3 py-1.5 text-paper">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span className="rounded-full bg-paper/70 px-3 py-1.5 text-xs font-medium backdrop-blur">
                  <span className="num">{p.count}</span> منتج
                </span>
              </header>

              {/* الأكواب */}
              <div className="pointer-events-none relative my-4 flex flex-1 items-end justify-center gap-[3%] lg:absolute lg:inset-y-[16%] lg:left-[4%] lg:my-0 lg:w-[48%] lg:items-center">
                {p.cups.map((c, i) => (
                  <div
                    key={c.url}
                    className={`fam-cup relative h-[30vh] will-change-transform ${
                      i === 1 ? "z-10 lg:h-[92%]" : "mt-8 lg:mt-0 lg:h-[72%]"
                    }`}
                    style={{ aspectRatio: `${c.w} / ${c.h}` }}
                  >
                    <Image
                      src={c.url}
                      alt={c.alt}
                      fill
                      sizes="(min-width:1024px) 16vw, 28vw"
                      className="object-contain drop-shadow-[0_26px_30px_rgba(11,11,12,0.22)]"
                    />
                  </div>
                ))}
              </div>

              <div className="relative lg:max-w-[46%]">
                <h3 className="t-h1 !text-[clamp(2.2rem,5.4vw,5rem)]">{p.name}</h3>
                <p className="t-accent mt-1 text-[clamp(1.3rem,2.4vw,2.2rem)]">{p.line}</p>
                <p className="mt-4 max-w-md text-sm leading-loose text-ink/75 md:text-base">{p.blurb}</p>

                {p.specs.length > 0 && (
                  <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3 border-t border-ink/15 pt-5">
                    {p.specs.map((s) => (
                      <div key={s.label}>
                        <dd className="font-display text-2xl font-black md:text-3xl">
                          <span className="num">{s.value}</span>{" "}
                          <span className="text-xs font-semibold text-ink/60">{s.unit}</span>
                        </dd>
                        <dt className="mt-0.5 text-xs text-ink/65">{s.label}</dt>
                      </div>
                    ))}
                  </dl>
                )}

                <div className="mt-7 flex flex-wrap items-center gap-4">
                  <TLink href={`/shop?family=${p.key}`} className="btn btn-ink">
                    تسوّق {p.name}
                    <ArrowLeft size={17} />
                  </TLink>
                  <span className="text-sm text-ink/70">
                    يبدأ من <span className="num font-display font-bold text-ink">{formatAmount(p.fromPrice)}</span> ر.س
                  </span>
                </div>
              </div>
            </div>
          </article>
        ))}
        <div className="w-[var(--gutter)] shrink-0 lg:w-[6vw]" aria-hidden />
      </div>
    </section>
  );
}
