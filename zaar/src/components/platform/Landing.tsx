"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import {
  ArrowLeft, ArrowUp, BadgePercent, Banknote, BarChart3, Check, MessageSquareHeart, Palette, Receipt, ShieldCheck, ShoppingBag, Sparkles, Star, Store, Wallet, X,
} from "lucide-react";
import { Magnetic } from "@/components/ui/Magnetic";
import { Marquee } from "@/components/ui/Marquee";
import { CountUp, Reveal, SplitText } from "@/components/ui/Reveal";
import { SmoothScroll } from "@/components/ui/SmoothScroll";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const EASE = [0.16, 1, 0.3, 1] as const;
const SOFT_EASE = [0.22, 1, 0.36, 1] as const;
const IDEAS = ["أبي أبيع عطور وبخور فاخر", "متجر قهوة مختصة اسمه رشفة", "عبايات بقصّات عصرية", "ستريت وير شبابي", "حلا وبوكسات ضيافة", "إكسسوارات قيمنق"];

type Props = { feePercent: number; feeFixed: number; guaranteeDays: number; replyHours: number; loggedIn: boolean; demos: { bold: string | null; soft: string | null } };

/** شخابيط مرسومة باليد حول كلمة «زار» (تقنية شعار «حطّها»: ترسم نفسها ثم تهتز) */
const SCRIBBLES: { d: string; tone: string; delay: number; dur?: number }[] = [
  { d: "M940 372C760 352 560 404 380 378S160 352 70 386C22 404 40 432 96 421C156 408 126 374 76 382", tone: "accent", delay: 0.9, dur: 0.9 },
  { d: "M1010 20L1056 -34", tone: "b", delay: 1.45, dur: 0.25 },
  { d: "M1046 52L1114 36", tone: "b", delay: 1.55, dur: 0.25 },
  { d: "M980 -12L990 -80", tone: "b", delay: 1.65, dur: 0.25 },
  { d: "M-28 70C-102 48-102-46-30-46C22-46 32 16-20 16C-52 16-54-18-30-18", tone: "c", delay: 1.7, dur: 0.7 },
  { d: "M470 -70L514 -16", tone: "a", delay: 2.05, dur: 0.2 },
  { d: "M514 -70L470 -16", tone: "a", delay: 2.15, dur: 0.2 },
  { d: "M460 -43L524 -43", tone: "a", delay: 2.25, dur: 0.2 },
  { d: "M1030 300L1062 270L1084 306L1116 274L1138 306", tone: "b", delay: 2.4, dur: 0.5 },
  { d: "M1090 180A13 13 0 1 0 1116 180A13 13 0 1 0 1090 180", tone: "c", delay: 2.75, dur: 0.35 },
];

function Scribbles({ play }: { play: boolean }) {
  const id = useId().replace(/:/g, "");
  const still = useReducedMotion();
  return (
    <svg viewBox="-130 -110 1300 580" preserveAspectRatio="none" aria-hidden className="pointer-events-none absolute inset-[-22%_-12%] h-[144%] w-[124%] overflow-visible">
      <defs>
        <filter id={`${id}-boil`} x="-20%" y="-60%" width="140%" height="220%">
          <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="3" result="noise">
            {!still && <animate attributeName="seed" values="3;11;27;42;8" dur="0.75s" calcMode="discrete" repeatCount="indefinite" />}
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="9" />
        </filter>
      </defs>
      <g filter={`url(#${id}-boil)`} fill="none" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round">
        {SCRIBBLES.map((s, i) => (
          <motion.path
            key={i}
            d={s.d}
            className={`z-scribble-${s.tone}`}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={play ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
            transition={{ pathLength: { duration: s.dur ?? 0.4, ease: "easeOut", delay: s.delay }, opacity: { duration: 0.01, delay: s.delay } }}
          />
        ))}
      </g>
    </svg>
  );
}

/** حقل الفكرة: يكتب أمثلة بنفسه حتى يبدأ التاجر الكتابة، وعند الإرسال ينتقل لصفحة البناء */
function IdeaBox({ dark = true, autoFocus = false }: { dark?: boolean; autoFocus?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [hint, setHint] = useState("");
  const still = useReducedMotion();

  useEffect(() => {
    if (still) {
      setHint(IDEAS[0]);
      return;
    }
    let idea = 0;
    let pos = 0;
    let dir = 1;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const text = IDEAS[idea];
      pos += dir;
      setHint(text.slice(0, pos));
      let wait = dir > 0 ? 55 : 22;
      if (pos === text.length) {
        dir = -1;
        wait = 1700;
      } else if (pos === 0) {
        dir = 1;
        idea = (idea + 1) % IDEAS.length;
        wait = 350;
      }
      timer = setTimeout(tick, wait);
    };
    timer = setTimeout(tick, 900);
    return () => clearTimeout(timer);
  }, [still]);

  const go = (text: string) => router.push(`/start${text.trim() ? `?idea=${encodeURIComponent(text.trim())}` : ""}`);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        go(value);
      }}
      className={`flex items-center gap-2 rounded-full p-2 ps-6 ring-1 transition-shadow focus-within:ring-2 focus-within:ring-accent ${dark ? "bg-paper/[0.08] ring-paper/15 backdrop-blur" : "bg-white ring-ink/15 shadow-xl"}`}
    >
      <Sparkles size={20} className="shrink-0 text-accent" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus={autoFocus}
        maxLength={600}
        aria-label="اكتب فكرة متجرك"
        placeholder={hint || " "}
        className={`min-w-0 flex-1 bg-transparent py-3 text-base outline-none md:text-lg ${dark ? "text-paper placeholder:text-paper/45" : "text-ink placeholder:text-ink/40"}`}
      />
      <button type="submit" className="flex h-12 shrink-0 items-center gap-2 rounded-full bg-accent px-5 font-display text-sm font-bold text-on-accent transition-transform hover:scale-[1.04] active:scale-95 md:h-14 md:px-7">
        <span className="hidden sm:inline">ابنِ متجري</span>
        <ArrowUp size={18} strokeWidth={2.6} className="sm:hidden" />
        <ArrowLeft size={18} className="hidden sm:block" />
      </button>
    </form>
  );
}

function Hero() {
  const root = useRef<HTMLElement>(null);
  const [play, setPlay] = useState(false);

  useGSAP(
    () => {
      const intro = gsap
        .timeline({ paused: true, defaults: { ease: "expo.out" } })
        .to(".lh-word", { y: 0, rotate: 0, duration: 1.4 }, 0)
        .to(".lh-hw", { y: 0, rotate: 0, duration: 1.1, stagger: 0.09 }, 0.35)
        .to(".lh-fade", { y: 0, opacity: 1, duration: 1, stagger: 0.09 }, 0.6);
      const start = () => {
        intro.play();
        setPlay(true);
      };
      if (document.documentElement.classList.contains("no-preload")) gsap.delayedCall(0.25, start);
      else {
        window.addEventListener("zaar:intro-start", start, { once: true });
        window.addEventListener("zaar:intro-done", start, { once: true });
      }
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap
          .timeline({ scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true }, defaults: { ease: "none" } })
          .to(".lh-mark", { yPercent: 28, scale: 0.92 }, 0)
          .to(".lh-orbs", { yPercent: 22 }, 0)
          .to(".lh-ui", { opacity: 0, y: -40 }, 0);
      });
      return () => {
        window.removeEventListener("zaar:intro-start", start);
        window.removeEventListener("zaar:intro-done", start);
      };
    },
    { scope: root },
  );

  return (
    <section ref={root} className="grain relative flex min-h-[100svh] flex-col overflow-hidden bg-ink text-paper">
      <div className="lh-orbs z-orbs opacity-60" aria-hidden>
        <span className="z-orb z-orb-1" style={{ background: "#19E28C" }} />
        <span className="z-orb z-orb-2" style={{ background: "#7c5cff" }} />
        <span className="z-orb z-orb-3" style={{ background: "#ff7a3d" }} />
      </div>

      <div className="wrap relative flex flex-1 flex-col items-center justify-center pb-12 pt-24 text-center">
        <p className="lh-ui lh-fade mb-8 inline-flex items-center gap-2.5 rounded-full border border-paper/15 bg-paper/[0.06] px-4 py-2 text-xs font-medium backdrop-blur md:text-sm" style={{ opacity: 0, transform: "translateY(24px)" }}>
          <span className="z-dot" /> منصة تجارة إلكترونية سعودية — من نوع جديد
        </p>

        <h1 className="sr-only">زار — قل فكرتك، ومتجرك جاهز في ثوانٍ</h1>
        <div className="lh-mark relative" aria-hidden>
          <div className="overflow-hidden px-[0.08em] py-[0.06em]">
            <span
              className="lh-word block font-display font-black leading-[1.18] text-accent will-change-transform"
              style={{ fontSize: "clamp(7rem, min(24vw, 34svh), 20rem)", transform: "translateY(112%) rotate(5deg)", transformOrigin: "100% 100%" }}
            >
              زار
            </span>
          </div>
          <Scribbles play={play} />
        </div>

        <p className="lh-ui t-h1 mt-3 !text-[clamp(1.6rem,4.4vw,3.6rem)]" aria-hidden>
          {["قل", "فكرتك.", "ومتجرك", "جاهز."].map((w, i) => (
            <span key={i} className="-my-[0.1em] me-[0.22em] inline-block overflow-hidden py-[0.16em] align-top">
              <span className={`lh-hw inline-block will-change-transform ${i === 1 || i === 3 ? "t-accent text-[1.1em] font-normal text-accent" : ""}`} style={{ transform: "translateY(118%) rotate(5deg)", transformOrigin: "100% 100%" }}>
                {w}
              </span>
            </span>
          ))}
        </p>

        <p className="lh-ui lh-fade mt-4 max-w-xl text-sm leading-loose text-paper/65 md:text-base" style={{ opacity: 0, transform: "translateY(24px)" }}>
          ما تحتاج مصمم ولا مبرمج ولا بوابة دفع. اكتب وش تبي تبيع، وخلال ثوانٍ يطلع متجرك كامل: يقبل الدفع، يحوّل لك أرباحك يوميًا، وكل طلب فيه مضمون.
        </p>

        <div className="lh-ui lh-fade mt-6 w-full max-w-2xl" style={{ opacity: 0, transform: "translateY(24px)" }}>
          <IdeaBox />
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-paper/50">
            {["بدون اشتراك شهري", "مدى · Apple Pay · تابي · تمارا", "تحويل يومي لحسابك", "ضمان استرداد لعملائك"].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <Check size={13} className="text-accent" strokeWidth={3} /> {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/** بيان المنصة: الكلمات تمتلئ بالضوء مع التمرير (من «بيان» PUFF) */
function Manifesto() {
  const root = useRef<HTMLElement>(null);
  const text = "فتح متجر إلكتروني كان يبيله مصمم، مبرمج، بوابة دفع، وأسابيع تجهيز. في زار يبيله جملة وحدة. تكتب فكرتك، والذكاء يبني الهوية والمنتجات والأسعار، وإحنا نتكفّل بالدفع والتحويل والضمان.";
  const accent = new Set(["جملة", "وحدة", "الضمان"]);
  useGSAP(
    () => {
      gsap.fromTo(".lm-word", { opacity: 0.14 }, { opacity: 1, ease: "none", stagger: 0.08, scrollTrigger: { trigger: ".lm-text", start: "top 82%", end: "bottom 45%", scrub: 0.5 } });
    },
    { scope: root },
  );
  return (
    <section ref={root} className="relative z-10 -mt-10 rounded-t-[2.2rem] bg-paper py-24 text-ink md:-mt-14 md:rounded-t-[3.5rem] md:py-40">
      <div className="wrap">
        <Reveal as="p" className="t-eyebrow mb-8 text-ink/50 md:mb-12">
          ليش زار
        </Reveal>
        <p className="lm-text max-w-[26ch] font-display text-[clamp(1.6rem,4.6vw,4.4rem)] font-extrabold leading-[1.5] md:leading-[1.38]">
          {text.split(" ").map((w, i) => (
            <span key={i} className={`lm-word inline-block ${accent.has(w.replace(/[.،]/g, "")) ? "t-accent font-normal text-[#0b9d62]" : ""}`}>
              {w}&nbsp;
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}

/** مشهد «من فكرة إلى متجر» (حركة تبادل البطاقات من «حطّها»): رسالة المحادثة تتبدّل مكانها مع المتجر الجاهز */
const SWAPS = [
  { idea: "أبي أبيع عطور وبخور", name: "عبق", hue: 42, icon: "عطور" },
  { idea: "متجر قهوة مختصة", name: "رشفة", hue: 22, icon: "قهوة" },
  { idea: "عبايات عصرية", name: "سدو", hue: 280, icon: "أزياء" },
  { idea: "إكسسوارات قيمنق", name: "LEVEL", hue: 255, icon: "قيمنق" },
];

function IdeaSwap() {
  const [i, setI] = useState(0);
  const [swapped, setSwapped] = useState(false);
  const [d, setD] = useState(200);
  useEffect(() => {
    const fit = () => setD(window.innerWidth < 560 ? 154 : 204);
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  useEffect(() => {
    const a = setTimeout(() => setSwapped(true), 1300);
    const b = setTimeout(() => {
      setSwapped(false);
      setI((x) => (x + 1) % SWAPS.length);
    }, 4200);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [i]);
  const s = SWAPS[i];
  const spring = { duration: 1.1, ease: SOFT_EASE };
  const card = "w-[140px] rounded-[26px] border border-ink/10 bg-white p-2.5 shadow-[0_30px_80px_-24px_rgba(0,0,0,0.35)] sm:w-[184px]";

  return (
    <div className="relative grid h-[380px] place-items-center overflow-hidden md:h-[520px]" aria-hidden>
      <div className="absolute aspect-square w-[min(440px,92%)] animate-[zSpin_50s_linear_infinite] rounded-full border border-dashed border-ink/20" />
      <AnimatePresence mode="wait">
        <motion.div key={i} className="relative flex gap-5" initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: -16 }} transition={{ duration: 0.5, ease: SOFT_EASE }}>
          <motion.div animate={swapped ? { x: -d, y: [0, -46, 0], rotate: [-5, 4, 5], scale: [1, 1.07, 1] } : { x: 0, y: 0, rotate: -5, scale: 1 }} transition={spring} style={{ zIndex: 3 }}>
            <div className={card}>
              <div className="grid aspect-[1/1.08] place-items-center rounded-[19px] bg-ink p-3 text-center">
                <p className="rounded-2xl rounded-ss-md bg-accent px-3 py-2 text-xs font-semibold leading-relaxed text-on-accent sm:text-sm">{s.idea}</p>
              </div>
              <div className="px-2 pb-1.5 pt-3">
                <strong className="block text-sm font-semibold">فكرتك</strong>
                <span className="text-xs text-ink/50">جملة وحدة</span>
              </div>
            </div>
          </motion.div>
          <motion.div animate={swapped ? { x: d, y: [0, 46, 0], rotate: [5, -4, -5], scale: [1, 0.93, 1] } : { x: 0, y: 0, rotate: 5, scale: 1 }} transition={spring} style={{ zIndex: 1 }}>
            <div className={card}>
              <div className="p-art aspect-[1/1.08] overflow-hidden rounded-[19px]" style={{ ["--h" as string]: s.hue }}>
                <span className="font-display text-3xl font-black sm:text-4xl">{s.name}</span>
              </div>
              <div className="px-2 pb-1.5 pt-3">
                <strong className="block text-sm font-semibold">متجرك</strong>
                <span className="text-xs text-ink/50">{s.icon} · جاهز للبيع</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
      <motion.div className="absolute z-[5] grid h-14 w-14 place-items-center rounded-full bg-ink text-accent shadow-[0_0_0_7px_rgb(var(--paper))]" animate={{ rotate: swapped ? 180 : 0, scale: swapped ? [1, 1.25, 1] : 1 }} transition={{ duration: 0.9, ease: SOFT_EASE }}>
        <Sparkles size={22} />
      </motion.div>
      <AnimatePresence>
        {swapped && (
          <motion.div
            className="absolute bottom-[4%] z-[6] inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white py-2 pe-4 ps-2.5 text-sm font-medium shadow-lg"
            initial={{ opacity: 0, y: 14, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ delay: 0.9, type: "spring", stiffness: 400, damping: 22 }}
          >
            <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-[#0f8a5f] text-white">
              <Check size={13} strokeWidth={3} />
            </span>
            تم — متجرك جاهز في ثوانٍ
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const JOURNEY = [
  { n: "01", title: "قل فكرتك", accent: "بجملة.", text: "افتح المحادثة واكتب وش تبي تبيع. إذا عندك اسم أو منتجات محددة قلها، وإذا لا — زار يقترح كل شي.", bg: "#D9F7A1", mock: "chat" },
  { n: "02", title: "متجرك جاهز", accent: "في ثوانٍ.", text: "اسم، هوية، تصميم كامل بأنيميشن سينمائي، تصنيفات، ومنتجات بأوصافها وأسعارها. عدّل أي شي بالكلام.", bg: "#E4DBFF", mock: "store" },
  { n: "03", title: "استقبل الدفع", accent: "من أول يوم.", text: "مدى، فيزا، Apple Pay، تابي وتمارا — كلها مربوطة جاهزة. ما تفتح حساب عند أي بوابة ولا توقّع أي عقد.", bg: "#FFE0CC", mock: "pay" },
  { n: "04", title: "أرباحك", accent: "كل يوم.", text: "مبيعات اليوم تتحوّل لآيبانك بكرة. بدون ما تطلب، وبدون انتظار أسبوع أو شهر.", bg: "#C9F3DF", mock: "payout" },
] as const;

function Mock({ kind }: { kind: (typeof JOURNEY)[number]["mock"] }) {
  const box = "w-full max-w-sm rounded-[1.8rem] bg-white p-4 shadow-[0_30px_60px_-24px_rgba(11,11,12,0.4)]";
  if (kind === "chat") {
    return (
      <div className={`${box} space-y-2.5`}>
        <p className="w-fit rounded-3xl rounded-ss-lg bg-ink px-4 py-2.5 text-sm text-paper">أبي أبيع قهوة مختصة، واسم المتجر رشفة</p>
        <p className="ms-auto w-fit max-w-[85%] rounded-3xl rounded-se-lg bg-ink/[0.06] px-4 py-2.5 text-sm">جهّزت لك «رشفة»: 10 منتجات، 3 تصنيفات، وتصميم جريء. تبي أعدّل شي؟</p>
        <p className="w-fit rounded-3xl rounded-ss-lg bg-ink px-4 py-2.5 text-sm text-paper">خل الألوان ذهبي</p>
        <p className="ms-auto flex w-fit items-center gap-1.5 rounded-3xl rounded-se-lg bg-accent/40 px-4 py-2.5 text-sm font-semibold">
          <Check size={14} strokeWidth={3} /> تم
        </p>
      </div>
    );
  }
  if (kind === "store") {
    return (
      <div className={`${box} !p-0 overflow-hidden`}>
        <div className="bg-[#F3ECDF] p-4">
          <p className="font-display text-5xl font-black tracking-tighter">RASHFA</p>
          <p className="mt-1 text-xs font-semibold">حمصة. رشفة. مزاج.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 p-3">
          {[330, 25, 15].map((h) => (
            <div key={h}>
              <div className="p-art aspect-[4/5] rounded-xl" style={{ ["--h" as string]: h }} />
              <div className="mt-1.5 h-2 w-3/4 rounded-full bg-ink/15" />
              <div className="mt-1 h-2 w-1/3 rounded-full bg-ink/40" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (kind === "pay") {
    return (
      <div className={`${box} space-y-2.5`}>
        {["مدى / فيزا / Apple Pay", "تابي — 4 دفعات", "تمارا — 3 دفعات"].map((m, i) => (
          <div key={m} className={`flex items-center gap-3 rounded-2xl border-[1.5px] px-4 py-3 text-sm font-medium ${i === 0 ? "border-ink bg-ink/[0.04]" : "border-ink/12"}`}>
            <span className={`grid h-4 w-4 place-items-center rounded-full border-2 ${i === 0 ? "border-ink" : "border-ink/25"}`}>{i === 0 && <span className="h-2 w-2 rounded-full bg-ink" />}</span>
            {m}
          </div>
        ))}
        <div className="flex items-center justify-center gap-2 rounded-full bg-ink py-3 text-sm font-bold text-paper">
          <ShieldCheck size={15} className="text-accent" /> ادفع — مضمون بضمان زار
        </div>
      </div>
    );
  }
  return (
    <div className={`${box} space-y-3`}>
      <p className="text-xs text-ink/50">تحويل اليوم إلى حسابك</p>
      <p className="font-display text-5xl font-black">
        <span className="num">4,860</span> <span className="text-base font-semibold">ر.س</span>
      </p>
      <div className="flex items-end gap-1.5 pt-2" dir="ltr">
        {[38, 55, 42, 70, 62, 88, 100].map((h, i) => (
          <span key={i} className={`flex-1 rounded-t-[4px] ${i === 6 ? "bg-ink" : "bg-ink/25"}`} style={{ height: `${h * 0.7}px` }} />
        ))}
      </div>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-[#0b9d62]">
        <Check size={13} strokeWidth={3} /> يتحوّل تلقائيًا كل يوم بعد منتصف الليل
      </p>
    </div>
  );
}

/** الرحلة (من «عائلات» PUFF): على سطح المكتب يتحول التمرير العمودي إلى رحلة أفقية بين اللوحات */
function Journey() {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
        const el = track.current!;
        const distance = () => el.scrollWidth - window.innerWidth;
        const tween = gsap.to(el, {
          x: () => distance(),
          ease: "none",
          scrollTrigger: { trigger: root.current, start: "top top", end: () => `+=${distance()}`, pin: true, scrub: 0.8, invalidateOnRefresh: true, anticipatePin: 1 },
        });
        gsap.utils.toArray<HTMLElement>(".jn-panel").forEach((panel) => {
          gsap.fromTo(panel.querySelector(".jn-mock"), { yPercent: 16, rotate: -5 }, { yPercent: 0, rotate: 2, ease: "none", scrollTrigger: { trigger: panel, containerAnimation: tween, start: "right 20%", end: "left 80%", scrub: true } });
          gsap.fromTo(panel.querySelector(".jn-num"), { xPercent: -14 }, { xPercent: 14, ease: "none", scrollTrigger: { trigger: panel, containerAnimation: tween, start: "right left", end: "left right", scrub: true } });
        });
      });
    },
    { scope: root },
  );
  return (
    <section ref={root} id="how" aria-label="كيف يشتغل زار" className="relative overflow-hidden bg-paper text-ink">
      <div ref={track} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto will-change-transform lg:h-[100svh] lg:w-max lg:snap-none lg:overflow-visible">
        <div className="flex w-[78vw] shrink-0 snap-start flex-col justify-end px-[var(--gutter)] py-14 lg:w-[36vw] lg:justify-center lg:py-0">
          <p className="t-eyebrow text-ink/50">كيف يشتغل</p>
          <h2 className="t-h1 mt-4">
            أربع
            <br />
            <span className="t-accent font-normal">خطوات.</span>
            <br />
            ولا شي غيرها.
          </h2>
          <p className="mt-6 flex items-center gap-2 text-sm text-ink/60">
            <span className="lg:hidden">اسحب</span>
            <span className="hidden lg:inline">واصل التمرير</span>
            <ArrowLeft size={16} className="motion-safe:animate-pulse" />
          </p>
        </div>
        {JOURNEY.map((p) => (
          <article key={p.n} className="jn-panel relative flex w-[88vw] shrink-0 snap-center flex-col overflow-hidden p-2 lg:h-full lg:w-[72vw] lg:p-5">
            <div className="relative flex h-full min-h-[36rem] flex-col justify-between overflow-hidden rounded-tile p-6 md:p-10 lg:min-h-0" style={{ backgroundColor: p.bg }}>
              <div aria-hidden dir="ltr" className="jn-num t-mega t-outline pointer-events-none absolute inset-x-0 top-[2%] select-none text-center text-[42vw] opacity-50 lg:text-[26vw]" style={{ ["--stroke" as string]: "rgba(11,11,12,.28)" }}>
                {p.n}
              </div>
              <span className="num t-eyebrow relative w-fit rounded-full bg-ink px-3 py-1.5 text-paper">{p.n}</span>
              <div className="jn-mock relative my-6 flex flex-1 items-center justify-center will-change-transform lg:absolute lg:inset-y-[14%] lg:left-[5%] lg:my-0 lg:w-[44%]">
                <Mock kind={p.mock} />
              </div>
              <div className="relative lg:max-w-[46%]">
                <h3 className="t-h1 !text-[clamp(2rem,4.8vw,4.6rem)]">{p.title}</h3>
                <p className="t-accent mt-1 text-[clamp(1.4rem,2.6vw,2.4rem)]">{p.accent}</p>
                <p className="mt-4 max-w-md text-sm leading-loose text-ink/75 md:text-base">{p.text}</p>
              </div>
            </div>
          </article>
        ))}
        <div className="w-[var(--gutter)] shrink-0 lg:w-[6vw]" aria-hidden />
      </div>
    </section>
  );
}

const MORE = [
  { icon: BadgePercent, title: "كوبونات خصم", text: "نسبة، مبلغ، أو شحن مجاني — بحد أدنى وعدد استخدامات وتاريخ انتهاء." },
  { icon: MessageSquareHeart, title: "استرجاع السلال المتروكة", text: "تشوف من وصل للدفع وما كمّل، وتذكّره على واتساب بضغطة." },
  { icon: Star, title: "تقييمات موثّقة", text: "ما يقيّم إلا من اشترى واستلم، وتظهر النجوم على منتجاتك." },
  { icon: BarChart3, title: "تحليلات واضحة", text: "من الزيارة إلى الطلب: وين يوقف عملاؤك وكم نسبة التحويل." },
  { icon: Receipt, title: "فواتير وتتبع", text: "فاتورة لكل طلب، ورقم تتبع يوصل العميل، وصفحة تتبع بدون تسجيل." },
  { icon: Store, title: "بكسلات التسويق", text: "ميتا، تيك توك، وسناب — تحط المعرّف وتشتغل أحداث الشراء تلقائيًا." },
];

export function Landing({ feePercent, feeFixed, guaranteeDays, replyHours, loggedIn, demos }: Props) {
  const footer = useRef<HTMLElement>(null);
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 40);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useGSAP(
    () => {
      gsap.fromTo(".ft-letter", { yPercent: 105 }, { yPercent: 0, ease: "none", stagger: 0.12, scrollTrigger: { trigger: ".ft-word", start: "top bottom", end: "bottom bottom", scrub: 0.6 } });
    },
    { scope: footer },
  );

  const compare: [string, string, string][] = [
    ["وقت فتح المتجر", "ثوانٍ — بمحادثة", "أيام إلى أسابيع"],
    ["التصميم والمحتوى", "يبنيه الذكاء كاملًا", "قوالب تعبّيها بنفسك"],
    ["بوابات الدفع وتابي وتمارا", "مربوطة جاهزة", "تسجيل وعقود لكل بوابة"],
    ["استلام الأرباح", "تحويل يومي تلقائي", "أسبوعي أو عند الطلب"],
    ["حماية العميل", `ضمان استرداد كامل ${guaranteeDays} يومًا`, "حسب سياسة كل متجر"],
    ["الاشتراك الشهري", "صفر", "باقات شهرية"],
  ];

  return (
    <div className="bg-ink">
      <SmoothScroll />
      <header className={`fixed inset-x-0 top-0 z-[90] transition-colors duration-500 ${solid ? "border-b border-paper/10 bg-ink/80 backdrop-blur-xl" : ""}`}>
        <div className="wrap flex h-[68px] items-center justify-between gap-4 text-paper">
          <Link href="/" className="font-display text-3xl font-black leading-none" aria-label="زار — الرئيسية">
            زار
          </Link>
          <nav className="hidden items-center gap-7 text-[0.92rem] font-medium text-paper/75 md:flex" aria-label="التنقل الرئيسي">
            <a href="#how" className="link-draw">كيف يشتغل</a>
            <a href="#features" className="link-draw">المزايا</a>
            <a href="#guarantee" className="link-draw">ضمان زار</a>
            <a href="#themes" className="link-draw">الثيمات</a>
            <a href="#pricing" className="link-draw">الأسعار</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href={loggedIn ? "/dashboard" : "/login"} className="rounded-full px-4 py-2 text-sm font-medium text-paper/80 hover:text-paper">
              {loggedIn ? "لوحة التحكم" : "دخول"}
            </Link>
            <Link href="/start" className="hidden h-10 items-center gap-2 rounded-full bg-accent px-5 font-display text-xs font-bold text-on-accent transition-transform hover:scale-[1.04] sm:inline-flex">
              ابدأ الآن
            </Link>
          </div>
        </div>
      </header>

      <Hero />
      <Manifesto />

      <div className="bg-accent py-4 text-on-accent md:py-6">
        <Marquee items={["متجرك في ثوانٍ", "ZAAR", "تحويل يومي", "ضمان زار", "تابي", "تمارا", "مدى", "Apple Pay"]} itemClassName="font-display text-[clamp(1.5rem,4.5vw,3.6rem)] font-black" duration={38} />
      </div>

      <section className="bg-paper py-20 text-ink md:py-28">
        <div className="wrap grid items-center gap-8 lg:grid-cols-2">
          <div>
            <Reveal as="p" className="t-eyebrow text-ink/50">
              من فكرة إلى متجر
            </Reveal>
            <SplitText as="h2" className="t-h1 mt-3" text={"تكتبها.\nتطلع لك."} accentWords={["تطلع"]} />
            <Reveal as="p" className="mt-6 max-w-lg text-base leading-loose text-ink/70 md:text-lg">
              الذكاء في زار يفهم مجالك، يختار اسمًا وهوية وتصميمًا يناسبه، ويكتب منتجاتك بأوصافها وأسعارها. وبعد النشر يبقى معك مساعدًا في لوحة التحكم: «أضف منتج»، «سوِّ كوبون»، «كم بعت اليوم؟».
            </Reveal>
            <Reveal className="mt-8">
              <Magnetic>
                <Link href="/start" className="btn btn-ink !min-h-[3.6rem] !px-8 !text-base">
                  جرّب الآن — مجانًا
                  <ArrowLeft size={18} />
                </Link>
              </Magnetic>
            </Reveal>
          </div>
          <IdeaSwap />
        </div>
      </section>

      <Journey />

      {/* ───── المزايا ───── */}
      <section id="features" className="bg-paper py-20 text-ink md:py-32">
        <div className="wrap">
          <Reveal as="p" className="t-eyebrow text-ink/50">
            اللي يميّز زار
          </Reveal>
          <SplitText as="h2" className="t-h1 mt-3" text={"منصة تشتغل\nعنك."} accentWords={["عنك"]} />

          <div className="mt-12 grid gap-4 md:mt-16 md:grid-cols-3">
            <Reveal className="relative flex min-h-[20rem] flex-col justify-end overflow-hidden rounded-tile bg-ink p-8 text-paper md:col-span-2">
              <span className="z-glow -left-24 -top-40 h-[26rem] w-[26rem]" aria-hidden />
              <Wallet size={28} strokeWidth={1.5} className="absolute start-8 top-8 text-accent" />
              <p className="relative font-display text-[clamp(5rem,12vw,10rem)] font-black leading-none text-accent">
                <CountUp to={24} /> <span className="text-[0.22em] font-semibold text-paper/70">ساعة</span>
              </p>
              <h3 className="t-h3 relative mt-2">تحويل يومي لأرباحك</h3>
              <p className="relative mt-2 max-w-xl text-sm leading-loose text-paper/65 md:text-base">مبيعات اليوم تتحوّل لحسابك البنكي بكرة — تلقائيًا، كل يوم. تشوف في محفظتك كل ريال: المبيعة، العمولة، والتحويل.</p>
            </Reveal>
            <Reveal index={1} className="flex min-h-[20rem] flex-col justify-between rounded-tile bg-accent p-8 text-on-accent">
              <ShieldCheck size={28} strokeWidth={1.5} />
              <div>
                <p className="font-display text-6xl font-black leading-none md:text-7xl">
                  <span className="num">100</span>
                  <span className="text-3xl">%</span>
                </p>
                <h3 className="t-h3 mt-2">ضمان استرداد كامل</h3>
                <p className="mt-2 text-sm leading-loose opacity-80">كل طلب من أي متجر على زار مضمون. العميل يشتري وهو مطمئن، وأنت تبيع أكثر.</p>
              </div>
            </Reveal>
            <Reveal className="bg-paper-deep flex min-h-[17rem] flex-col justify-between rounded-tile p-8">
              <ShoppingBag size={28} strokeWidth={1.5} />
              <div>
                <div className="mb-4 flex flex-wrap gap-2">
                  {["مدى", "VISA", "Apple Pay", "tabby", "tamara"].map((m, i) => (
                    <motion.span key={m} className="rounded-full bg-white px-3.5 py-1.5 font-display text-xs font-bold shadow-sm" animate={{ y: [0, -5, 0] }} transition={{ duration: 3, delay: i * 0.35, repeat: Infinity, ease: "easeInOut" }}>
                      {m}
                    </motion.span>
                  ))}
                </div>
                <h3 className="t-h3 !text-xl">الدفع مربوط جاهز</h3>
                <p className="mt-2 text-sm leading-loose text-ink/65">بدون حساب تاجر عند أي بوابة. زار تستلم عنك وتحوّل لك.</p>
              </div>
            </Reveal>
            <Reveal index={1} className="bg-paper-deep flex min-h-[17rem] flex-col justify-between rounded-tile p-8">
              <Sparkles size={28} strokeWidth={1.5} />
              <div>
                <h3 className="t-h3 !text-xl">مساعد يدير متجرك بالكلام</h3>
                <p className="mt-2 text-sm leading-loose text-ink/65">«نزّل سعر العود 10%»، «أضف ثلاث منتجات شتوية»، «كم صافي أرباحي هذا الشهر؟» — يكفي تكتبها.</p>
              </div>
            </Reveal>
            <Reveal index={2} className="bg-paper-deep flex min-h-[17rem] flex-col justify-between rounded-tile p-8">
              <Banknote size={28} strokeWidth={1.5} />
              <div>
                <h3 className="t-h3 !text-xl">بدون اشتراك</h3>
                <p className="mt-2 text-sm leading-loose text-ink/65">
                  ما تدفع إلا لما تبيع: <span className="num font-bold">{feePercent}%</span> + <span className="num font-bold">{feeFixed}</span> ر.س لكل طلب مدفوع. ما بعت؟ ما عليك شي.
                </p>
              </div>
            </Reveal>
          </div>

          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MORE.map((f, i) => (
              <Reveal as="li" key={f.title} index={i % 3} className="rounded-tile border border-ink/10 p-6">
                <f.icon size={22} strokeWidth={1.6} />
                <h3 className="mt-4 font-display text-base font-bold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-loose text-ink/60">{f.text}</p>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* ───── ضمان زار ───── */}
      <section id="guarantee" className="on-ink relative overflow-hidden bg-ink py-24 text-paper md:py-36">
        <div className="wrap grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <Reveal as="p" className="t-eyebrow text-accent">
              ضمان زار
            </Reveal>
            <SplitText as="h2" className="t-h1 mt-3" text={"كل طلب\nمضمون."} accentWords={["مضمون"]} accentClassName="t-accent text-accent" />
            <Reveal as="p" className="mt-6 max-w-lg text-base leading-loose text-paper/65 md:text-lg">
              أكبر خوف عند المشتري من متجر جديد: «وش يضمن لي؟». في زار الجواب واحد لكل المتاجر: إذا ما وصل طلبك، أو وصل غير اللي طلبته، ترجع فلوسك كاملة — وزار هي اللي تضمن.
            </Reveal>
            <Reveal className="mt-10 flex items-end gap-4">
              <CountUp to={guaranteeDays} className="t-mega text-[clamp(5rem,13vw,11rem)] text-accent" />
              <span className="pb-3 font-display text-lg font-bold text-paper/70">يومًا بعد الاستلام</span>
            </Reveal>
          </div>
          <ol className="space-y-3">
            {[
              ["العميل يطلب الاسترداد", "من صفحة تتبع طلبه، بضغطة، بدون حساب ولا مراسلات."],
              ["التاجر يرد", `يوافق أو يوضّح موقفه خلال ${replyHours} ساعة. إذا ما رد، يُعتمد الاسترداد تلقائيًا.`],
              ["زار تحسم", "لو اختلف الطرفان، فريق زار يراجع ويقرر بعدل."],
              ["المبلغ يرجع كامل", "لنفس وسيلة الدفع: البطاقة، تابي، أو تمارا."],
            ].map(([t, d], i) => (
              <Reveal as="li" key={t} index={i} className="flex gap-5 rounded-tile border border-paper/12 bg-paper/[0.04] p-6">
                <span className="num font-display text-3xl font-black text-accent">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="font-display text-lg font-bold">{t}</h3>
                  <p className="mt-1 text-sm leading-loose text-paper/60">{d}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ───── الثيمات ───── */}
      <section id="themes" className="bg-paper py-20 text-ink md:py-32">
        <div className="wrap">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <Reveal as="p" className="t-eyebrow text-ink/50">
                <Palette size={14} className="me-2 inline" />
                الثيمات
              </Reveal>
              <SplitText as="h2" className="t-h1 mt-3" text={"تصميم يليق\nبعلامتك."} accentWords={["يليق"]} />
            </div>
            <Reveal as="p" className="max-w-sm text-sm leading-loose text-ink/60 md:text-base">
              ثيمان مبنيان بعناية، كل واحد بحركته وشخصيته. الذكاء يختار الأنسب لمجالك، وتقدر تبدّل بينهما بضغطة.
            </Reveal>
          </div>
          <div className="mt-12 grid gap-5 md:mt-16 md:grid-cols-2 md:gap-7">
            <Reveal clip className="group">
              <ThemeCard
                href={demos.bold ? `/s/${demos.bold}` : "/start"}
                name="جريء"
                text="كلمة عملاقة، تثبيت سينمائي بالتمرير، ورحلة أفقية بين التصنيفات. للعلامات اللي تبي تنشاف."
                className="bg-[#0B0B0C] text-[#D7FF3E]"
                live={Boolean(demos.bold)}
              >
                <span className="font-display text-[22vw] font-black leading-none tracking-[-0.06em] transition-transform duration-[1400ms] ease-expo group-hover:scale-110 md:text-[11vw]">BOLD</span>
              </ThemeCard>
            </Reveal>
            <Reveal clip index={1} className="group">
              <ThemeCard
                href={demos.soft ? `/s/${demos.soft}` : "/start"}
                name="ناعم"
                text="شريط زجاجي عائم، هالات لونية، وشخابيط مرسومة باليد. للعلامات الراقية والهادئة، بوضع فاتح وداكن."
                className="bg-white text-[#0d0d0d]"
                live={Boolean(demos.soft)}
              >
                <span className="absolute -left-10 -top-10 h-2/3 w-2/3 rounded-full bg-[#ffb489] opacity-70 blur-3xl" />
                <span className="absolute -bottom-16 left-1/3 h-2/3 w-2/3 rounded-full bg-[#b9a4ff] opacity-70 blur-3xl" />
                <span className="absolute -right-10 top-4 h-1/2 w-1/2 rounded-full bg-[#8fd6ff] opacity-70 blur-3xl" />
                <span className="relative font-display text-[20vw] font-black leading-[1.3] transition-transform duration-[1400ms] ease-expo group-hover:scale-110 md:text-[10vw]">ناعم</span>
              </ThemeCard>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ───── الأسعار والمقارنة ───── */}
      <section id="pricing" className="bg-paper pb-24 text-ink md:pb-36">
        <div className="wrap grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <Reveal className="relative overflow-hidden rounded-tile bg-ink p-8 text-paper md:p-12">
            <span className="z-glow -right-24 -top-32 h-96 w-96" aria-hidden />
            <p className="t-eyebrow relative text-accent">السعر</p>
            <p className="relative mt-6 font-display text-[clamp(4.5rem,11vw,8.5rem)] font-black leading-none">
              <span className="num">{feePercent}</span>
              <span className="text-[0.4em]">%</span>
            </p>
            <p className="relative mt-3 font-display text-xl font-bold">
              + <span className="num">{feeFixed}</span> ر.س لكل طلب مدفوع
            </p>
            <ul className="relative mt-8 space-y-3 text-sm text-paper/75">
              {["بدون اشتراك شهري ولا رسوم تأسيس", "كل المزايا مفتوحة من أول يوم", "العمولة ترجع لك إذا استُرد الطلب", "رسوم بوابات الدفع علينا"].map((t) => (
                <li key={t} className="flex items-center gap-2.5">
                  <Check size={16} className="shrink-0 text-accent" strokeWidth={3} /> {t}
                </li>
              ))}
            </ul>
            <Link href="/start" className="btn btn-accent relative mt-10 w-full !min-h-[3.6rem] !text-base">
              ابدأ الآن
              <ArrowLeft size={18} />
            </Link>
          </Reveal>
          <Reveal index={1} className="overflow-hidden rounded-tile border border-ink/10">
            <table className="w-full text-sm md:text-base">
              <thead>
                <tr className="bg-paper-deep text-start">
                  <th className="px-5 py-4 text-start font-display text-xs font-semibold text-ink/55 md:px-7" />
                  <th className="px-3 py-4 text-start font-display text-lg font-black md:px-5">زار</th>
                  <th className="px-3 py-4 text-start font-display text-xs font-semibold text-ink/55 md:px-5">المنصات التقليدية</th>
                </tr>
              </thead>
              <tbody>
                {compare.map(([k, a, b]) => (
                  <tr key={k} className="border-t border-ink/10">
                    <th className="px-5 py-4 text-start font-medium text-ink/70 md:px-7">{k}</th>
                    <td className="px-3 py-4 font-semibold md:px-5">
                      <span className="flex items-start gap-2">
                        <Check size={16} className="mt-1 shrink-0 text-[#0b9d62]" strokeWidth={3} /> {a}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-ink/55 md:px-5">
                      <span className="flex items-start gap-2">
                        <X size={15} className="mt-1 shrink-0 opacity-50" /> {b}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
        </div>
      </section>

      {/* ───── الختام ───── */}
      <section className="on-ink relative overflow-hidden bg-ink py-24 text-paper md:py-36">
        <div className="z-orbs opacity-50" aria-hidden>
          <span className="z-orb z-orb-1" style={{ background: "#19E28C" }} />
          <span className="z-orb z-orb-2" style={{ background: "#7c5cff" }} />
        </div>
        <Marquee items={["قل فكرتك", "ومتجرك جاهز", "في ثوانٍ"]} reverse duration={30} className="relative opacity-90" itemClassName="t-mega text-[clamp(3.2rem,13vw,12rem)] !leading-[1.3]" />
        <div className="wrap relative mt-12 max-w-3xl text-center">
          <p className="mb-6 text-base text-paper/65 md:text-lg">وش تبي تبيع؟</p>
          <IdeaBox />
        </div>
      </section>

      <footer ref={footer} className="on-ink relative overflow-hidden border-t border-paper/10 bg-ink text-paper">
        <div className="wrap flex flex-wrap items-center justify-between gap-x-8 gap-y-4 py-8 text-sm text-paper/55">
          <p>© {new Date().getFullYear()} زار — صُنع في السعودية</p>
          <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="روابط">
            <Link href="/start" className="hover:text-accent">ابنِ متجرك</Link>
            <Link href="/login" className="hover:text-accent">دخول التجار</Link>
            <a href="#guarantee" className="hover:text-accent">ضمان زار</a>
            <a href="#pricing" className="hover:text-accent">الأسعار</a>
          </nav>
        </div>
        <div className="ft-word select-none overflow-hidden" aria-hidden>
          <div dir="ltr" className="t-mega flex justify-center text-[31vw] text-accent" style={{ lineHeight: 0.74 }}>
            {"ZAAR".split("").map((c, i) => (
              <span key={i} className="ft-letter inline-block will-change-transform">
                {c}
              </span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

function ThemeCard({ href, name, text, className, live, children }: { href: string; name: string; text: string; className: string; live: boolean; children: React.ReactNode }) {
  return (
    <>
      <Link href={href} target={live ? "_blank" : undefined} className={`relative grid aspect-[4/3] place-items-center overflow-hidden rounded-tile border border-ink/10 ${className}`}>
        {children}
        <span className="absolute bottom-4 start-4 rounded-full bg-ink px-4 py-2 font-display text-xs font-bold text-paper">{live ? "شاهد متجرًا حيًا ←" : "جرّبه في متجرك ←"}</span>
      </Link>
      <div className="mt-5 px-1">
        <h3 className="t-h3">{name}</h3>
        <p className="mt-2 max-w-md text-sm leading-loose text-ink/65">{text}</p>
      </div>
    </>
  );
}
