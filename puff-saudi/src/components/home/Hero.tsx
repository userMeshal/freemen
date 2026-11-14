"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ArrowLeft, ArrowDown } from "lucide-react";
import { TLink } from "@/components/site/Transition";
import { Magnetic } from "@/components/ui/Magnetic";
import { formatAmount } from "@/lib/money";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export type HeroSlide = {
  slug: string;
  name: string;
  colorName: string | null;
  price: number;
  cutoutUrl: string;
  w: number;
  h: number;
  bg: string;
  accent: string;
};

const EASE = [0.16, 1, 0.3, 1] as const;
const AUTOPLAY_MS = 5200;
const HEADLINE = ["لونك.", "مزاجك.", "مشروبك."];

export function Hero({ slides }: { slides: HeroSlide[] }) {
  const root = useRef<HTMLElement>(null);
  const cupWrap = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [auto, setAuto] = useState(true);
  const slide = slides[index];

  const go = useCallback(
    (i: number, user = false) => {
      if (user) setAuto(false);
      setIndex((i + slides.length) % slides.length);
      // نبضة خفيفة في الحروف مع كل تغيير لون
      gsap.fromTo(
        ".hero-letter",
        { yPercent: 0 },
        { yPercent: -9, duration: 0.28, ease: "power2.out", stagger: 0.05, yoyo: true, repeat: 1, overwrite: "auto" },
      );
    },
    [slides.length],
  );

  // تبديل تلقائي — يتوقف عند تفاعل المستخدم أو إخفاء التبويب
  useEffect(() => {
    if (!auto || slides.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      if (!document.hidden && window.scrollY < window.innerHeight * 0.5) go(index + 1);
    }, AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [auto, index, go, slides.length]);

  useGSAP(
    () => {
      const el = root.current!;
      const mm = gsap.matchMedia();

      // ───── الافتتاحية ─────
      const intro = gsap
        .timeline({ paused: true, defaults: { ease: "expo.out" } })
        .to(".hero-letter", { y: 0, rotate: 0, duration: 1.35, stagger: 0.085 }, 0)
        .to(".hero-cup-in", { y: 0, opacity: 1, rotate: 0, scale: 1, duration: 1.5 }, 0.22)
        .to(".hero-hw", { y: 0, rotate: 0, duration: 1.1, stagger: 0.09 }, 0.5)
        .to(".hero-fade", { y: 0, opacity: 1, duration: 1, stagger: 0.08 }, 0.75);

      const play = () => intro.play();
      if (document.documentElement.classList.contains("no-preload")) gsap.delayedCall(0.3, play);
      else {
        window.addEventListener("puff:intro-start", play, { once: true });
        window.addEventListener("puff:intro-done", play, { once: true });
      }

      // ───── حركة المؤشر (سطح المكتب) ─────
      mm.add("(hover: hover) and (pointer: fine)", () => {
        const cx = gsap.quickTo(".hero-cup-float", "x", { duration: 1.1, ease: "power3.out" });
        const cy = gsap.quickTo(".hero-cup-float", "y", { duration: 1.1, ease: "power3.out" });
        const cr = gsap.quickTo(".hero-cup-float", "rotate", { duration: 1.3, ease: "power3.out" });
        const wx = gsap.quickTo(".hero-word", "x", { duration: 1.4, ease: "power3.out" });
        const move = (e: PointerEvent) => {
          const r = el.getBoundingClientRect();
          const nx = (e.clientX - r.left) / r.width - 0.5;
          const ny = (e.clientY - r.top) / r.height - 0.5;
          cx(nx * 34);
          cy(ny * 22);
          cr(nx * 5);
          wx(nx * -22);
        };
        el.addEventListener("pointermove", move);
        return () => el.removeEventListener("pointermove", move);
      });

      // ───── التمرير: سطح المكتب (تثبيت سينمائي) ─────
      mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
        gsap
          .timeline({
            scrollTrigger: { trigger: el, start: "top top", end: "+=85%", pin: true, scrub: 0.7, anticipatePin: 1 },
            defaults: { ease: "none" },
          })
          .to(".hero-lw-0", { xPercent: -190 }, 0)
          .to(".hero-lw-1", { xPercent: -95 }, 0)
          .to(".hero-lw-2", { xPercent: 95 }, 0)
          .to(".hero-lw-3", { xPercent: 190 }, 0)
          .to(".hero-cup-scroll", { scale: 1.28, yPercent: -3 }, 0)
          .to(".hero-ui", { opacity: 0, y: -40, stagger: 0.03 }, 0)
          .to(".hero-ring", { scale: 1.5, opacity: 1 }, 0.1);
      });

      // ───── التمرير: الجوال (بارالاكس خفيف بلا تثبيت) ─────
      mm.add("(max-width: 767px) and (prefers-reduced-motion: no-preference)", () => {
        gsap
          .timeline({
            scrollTrigger: { trigger: el, start: "top top", end: "bottom top", scrub: true },
            defaults: { ease: "none" },
          })
          .to(".hero-word", { yPercent: 45 }, 0)
          .to(".hero-cup-scroll", { yPercent: -14, scale: 1.12 }, 0)
          .to(".hero-ui", { opacity: 0, y: -24 }, 0);
      });

      return () => {
        window.removeEventListener("puff:intro-start", play);
        window.removeEventListener("puff:intro-done", play);
      };
    },
    { scope: root },
  );

  if (!slide) return null;

  return (
    <section
      ref={root}
      aria-label="بف — مجموعة الألوان"
      className="grain relative h-[100svh] min-h-[640px] overflow-hidden transition-[background-color] duration-[1100ms] ease-expo md:min-h-[700px]"
      style={{ backgroundColor: slide.bg }}
    >
      <noscript>
        <style>{`.hero-letter,.hero-hw,.hero-cup-in,.hero-fade{transform:none!important;opacity:1!important}`}</style>
      </noscript>

      {/* هالة لونية خلف الكوب */}
      <div
        aria-hidden
        className="hero-ring pointer-events-none absolute left-1/2 top-1/2 h-[78vmin] w-[78vmin] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 blur-3xl transition-[background-color] duration-[1100ms]"
        style={{ backgroundColor: slide.accent, opacity: 0.28 }}
      />

      {/* الكلمة العملاقة */}
      <h1 className="sr-only">PUFF SAUDI — أكواب بف: لونك، مزاجك، مشروبك</h1>
      <div
        aria-hidden
        dir="ltr"
        className="hero-word t-mega pointer-events-none absolute inset-x-0 top-[calc(var(--header-h)+3svh)] flex select-none justify-center text-[30.5vw] md:top-[46%] md:-translate-y-[58%] md:text-[27vw]"
      >
        {"PUFF".split("").map((c, i) => (
          <span key={i} className={`hero-lw-${i} -my-[0.06em] inline-block overflow-hidden py-[0.06em] will-change-transform`}>
            <span
              className="hero-letter inline-block will-change-transform"
              style={{ transform: "translateY(112%) rotate(6deg)", transformOrigin: "0 100%" }}
            >
              {c}
            </span>
          </span>
        ))}
      </div>

      {/* الكوب */}
      <div className="pointer-events-none absolute inset-x-0 top-[calc(var(--header-h)+17vw)] flex justify-center md:inset-0 md:top-0 md:items-center md:pb-[4svh]">
        <div
          className="hero-cup-in will-change-transform"
          style={{ transform: "translateY(22%) rotate(10deg) scale(0.92)", opacity: 0 }}
        >
          <div className="hero-cup-scroll will-change-transform">
            <div ref={cupWrap} className="hero-cup-float relative h-[43svh] w-[62vw] will-change-transform md:h-[min(72svh,760px)] md:w-[34vw]">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={slide.slug}
                  className="absolute inset-0"
                  initial={{ y: "14%", opacity: 0, rotate: 9, scale: 0.9 }}
                  animate={{ y: 0, opacity: 1, rotate: 0, scale: 1, transition: { duration: 0.95, ease: EASE } }}
                  exit={{ y: "-10%", opacity: 0, rotate: -7, scale: 0.94, transition: { duration: 0.32, ease: [0.7, 0, 0.84, 0] } }}
                >
                  <div className="h-full w-full motion-safe:animate-floaty">
                    <Image
                      src={slide.cutoutUrl}
                      alt={slide.name}
                      width={slide.w}
                      height={slide.h}
                      priority={index === 0}
                      sizes="(min-width: 768px) 34vw, 60vw"
                      className="mx-auto h-full w-auto object-contain drop-shadow-[0_40px_45px_rgba(11,11,12,0.28)]"
                    />
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* ختم دوّار */}
      <div
        aria-hidden
        className="hero-ui hero-fade absolute end-[var(--gutter)] top-[calc(var(--header-h)+1rem)] hidden h-28 w-28 lg:block"
        style={{ opacity: 0, transform: "translateY(30px)" }}
      >
        <svg viewBox="0 0 100 100" className="h-full w-full animate-spin-slow" style={{ direction: "ltr" }}>
          <defs>
            <path id="hero-circle" d="M50,50 m-38,0 a38,38 0 1,1 76,0 a38,38 0 1,1 -76,0" />
          </defs>
          <text fill="#0B0B0C" fontSize="9.2" letterSpacing="1.9" fontWeight="600" style={{ fontFamily: "var(--font-display)", direction: "ltr" }}>
            <textPath href="#hero-circle">COLOR IS A MOOD • PUFF SAUDI • </textPath>
          </text>
        </svg>
        <span className="absolute inset-0 m-auto grid h-11 w-11 place-items-center rounded-full bg-ink text-lime">
          <ArrowDown size={18} />
        </span>
      </div>

      {/* النصوص السفلية */}
      <div className="wrap absolute inset-x-0 bottom-0 flex flex-col gap-3 pb-[calc(2.5rem+max(1rem,env(safe-area-inset-bottom)))] md:flex-row md:items-end md:justify-between md:gap-5 md:pb-[5.5rem]">
        <div className="hero-ui">
          <p className="t-h1 whitespace-nowrap !text-[clamp(1.75rem,8.2vw,2.6rem)] !leading-[1.15] md:!text-[clamp(2rem,3.25vw,3.5rem)]" aria-hidden>
            {HEADLINE.map((w, i) => (
              <span key={w} className="-my-[0.1em] me-[0.2em] inline-block overflow-hidden py-[0.16em] align-top">
                <span
                  className={`hero-hw inline-block will-change-transform ${i === 1 ? "t-accent text-[1.12em] font-normal leading-none" : ""}`}
                  style={{ transform: "translateY(118%) rotate(5deg)", transformOrigin: "100% 100%" }}
                >
                  {w}
                </span>
              </span>
            ))}
          </p>
          <p
            className="hero-fade mt-3 hidden max-w-md text-[0.98rem] leading-loose text-ink/75 md:block"
            style={{ opacity: 0, transform: "translateY(30px)" }}
          >
            أكواب بف بعزل يحافظ على مشروبك لساعات، وعشرات الألوان لتختار ما يشبهك.
          </p>
          <div className="hero-fade mt-3 flex items-center gap-3 md:mt-6" style={{ opacity: 0, transform: "translateY(30px)" }}>
            <Magnetic>
              <TLink href="/shop" className="btn btn-ink md:!min-h-[3.6rem] md:!px-8 md:!text-base">
                تسوّق المجموعة
                <ArrowLeft size={18} />
              </TLink>
            </Magnetic>
            <a href="#colors" className="btn btn-ghost hidden sm:inline-flex">
              اختر لونك
            </a>
          </div>
        </div>

        {/* بطاقة اللون الحالي + التنقل */}
        <div className="hero-ui hero-fade order-first flex items-center justify-between gap-4 md:order-none md:flex-col md:items-end md:gap-6" style={{ opacity: 0, transform: "translateY(30px)" }}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={slide.slug}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE, delay: 0.15 } }}
              exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
              className="md:text-end"
            >
              <p className="t-eyebrow text-ink/60">
                <span className="num">{String(index + 1).padStart(2, "0")}</span> /{" "}
                <span className="num">{String(slides.length).padStart(2, "0")}</span>
              </p>
              <p className="mt-0.5 font-display text-base font-bold md:mt-1 md:text-2xl">{slide.colorName ?? slide.name}</p>
              <TLink href={`/p/${slide.slug}`} className="link-draw mt-0.5 hidden items-center gap-1.5 whitespace-nowrap text-sm md:inline-flex">
                <span className="num font-display font-bold">{formatAmount(slide.price)}</span>
                <span>ر.س — عرض المنتج</span>
              </TLink>
            </motion.div>
          </AnimatePresence>

          <div className="-me-2 flex items-center" role="tablist" aria-label="ألوان العرض">
            {slides.map((s, i) => (
              <button
                key={s.slug}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={s.colorName ?? s.name}
                onClick={() => go(i, true)}
                className="group grid h-9 w-8 place-items-center md:w-9"
              >
                <span
                  className={`block rounded-full border border-ink/20 transition-all duration-500 ease-expo group-hover:scale-125 ${
                    i === index ? "h-6 w-6 ring-2 ring-ink ring-offset-2" : "h-3.5 w-3.5"
                  }`}
                  style={{ backgroundColor: s.accent, ["--tw-ring-offset-color" as string]: slide.bg }}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
