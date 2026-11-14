"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useInView, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { ArrowLeft, Check, ShieldCheck, ShoppingBag, Truck } from "lucide-react";
import { Art } from "@/components/ui/Art";
import { Icon } from "@/components/ui/Icon";
import { formatAmount } from "@/lib/money";
import type { CategoryDTO, ProductCardDTO } from "@/lib/types";
import { SLink, useStore } from "../ctx";
import { EASE } from "./Chrome";

/** شخابيط مرسومة باليد حول الاسم — كل واحدة ترسم نفسها بالترتيب (من شعار «حطّها») */
const SCRIBBLES: { d: string; tone: "a" | "b" | "c" | "ink"; delay: number; dur?: number }[] = [
  { d: "M985 338C800 322 560 372 380 347S150 320 62 354C18 372 38 400 92 389C152 376 122 342 72 350", tone: "a", delay: 0.95, dur: 0.9 },
  { d: "M1042 -8L1088 -62", tone: "b", delay: 1.5, dur: 0.25 },
  { d: "M1078 24L1146 8", tone: "b", delay: 1.6, dur: 0.25 },
  { d: "M1012 -40L1022 -108", tone: "b", delay: 1.7, dur: 0.25 },
  { d: "M-38 34C-112 12-112-82-40-82C12-82 22-20-30-20C-62-20-64-54-40-54", tone: "c", delay: 1.75, dur: 0.7 },
  { d: "M498 -98L542 -44", tone: "a", delay: 2.1, dur: 0.2 },
  { d: "M542 -98L498 -44", tone: "a", delay: 2.2, dur: 0.2 },
  { d: "M488 -71L552 -71", tone: "a", delay: 2.3, dur: 0.2 },
  { d: "M-118 338C-128 252-86 204-26 192", tone: "ink", delay: 2.25, dur: 0.5 },
  { d: "M-58 170L-22 192L-52 222", tone: "ink", delay: 2.7, dur: 0.25 },
  { d: "M1058 262L1090 232L1112 268L1144 236L1166 268", tone: "b", delay: 2.5, dur: 0.5 },
  { d: "M1118 142A13 13 0 1 0 1144 142A13 13 0 1 0 1118 142", tone: "c", delay: 2.85, dur: 0.35 },
];

/** اسم المتجر ينكشف من اليمين ثم ترتسم حوله الشخابيط وتهتز كأنها مرسومة باليد */
export function Wordmark({ text }: { text: string }) {
  const id = useId().replace(/:/g, "");
  const still = useReducedMotion();
  const [run, setRun] = useState(0);
  return (
    <motion.div
      className="s-hero-logo"
      role="img"
      aria-label={text}
      onClick={() => setRun((r) => r + 1)}
      animate={still ? undefined : { y: [0, -5, 0] }}
      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 3.2 }}
    >
      <motion.span
        key={`t${run}`}
        className="s-hero-word block"
        aria-hidden
        initial={still ? false : { clipPath: "inset(-20% 0 -20% 100%)", skewX: -10, opacity: 0.6 }}
        animate={{ clipPath: "inset(-20% 0 -20% 0%)", skewX: 0, opacity: 1 }}
        transition={{ duration: 1.05, ease: EASE, delay: 0.1 }}
      >
        {text}
      </motion.span>
      <svg key={run} viewBox="-150 -130 1340 560" preserveAspectRatio="none" aria-hidden>
        <defs>
          <filter id={`${id}-boil`} x="-20%" y="-60%" width="140%" height="220%">
            <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="3" result="noise">
              {!still && <animate attributeName="seed" values="3;11;27;42;8" dur="0.75s" calcMode="discrete" repeatCount="indefinite" />}
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="9" />
          </filter>
        </defs>
        <g filter={`url(#${id}-boil)`} fill="none" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke">
          {SCRIBBLES.map((s, i) => (
            <motion.path
              key={i}
              d={s.d}
              className={`s-scribble-${s.tone}`}
              initial={still ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ pathLength: { duration: s.dur ?? 0.4, ease: "easeOut", delay: s.delay }, opacity: { duration: 0.01, delay: s.delay } }}
            />
          ))}
        </g>
      </svg>
    </motion.div>
  );
}

function MiniCard({ item }: { item: ProductCardDTO }) {
  return (
    <div className="s-swap-card">
      <div className="s-swap-art overflow-hidden">
        <Art image={item.image} art={item.art} alt="" />
      </div>
      <div className="s-swap-info">
        <strong className="truncate">{item.name}</strong>
        <span className="num">{formatAmount(item.price)} ر.س</span>
      </div>
    </div>
  );
}

/** مشهد الواجهة (من «حطّها»): بطاقتان تتبادلان مكانيهما فعليًا — هنا منتجات المتجر تتناوب */
export function Showcase({ products }: { products: ProductCardDTO[] }) {
  const pairs: [ProductCardDTO, ProductCardDTO][] = [];
  for (let i = 0; i + 1 < products.length && pairs.length < 5; i += 2) pairs.push([products[i], products[i + 1]]);
  const [i, setI] = useState(0);
  const [swapped, setSwapped] = useState(false);
  const [d, setD] = useState(190);
  const { store } = useStore();

  useEffect(() => {
    const fit = () => setD(window.innerWidth < 560 ? 150 : 190);
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => {
    if (!pairs.length) return;
    const a = setTimeout(() => setSwapped(true), 1300);
    const b = setTimeout(() => {
      setSwapped(false);
      setI((x) => (x + 1) % pairs.length);
    }, 4200);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [i, pairs.length]);

  if (!pairs.length) return null;
  const [a, b] = pairs[i % pairs.length];
  const spring = { duration: 1.1, ease: EASE };

  return (
    <div className="s-swap" aria-hidden>
      <div className="s-swap-orbit" />
      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          className="s-swap-stage"
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -16 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <motion.div
            className="s-swap-slot"
            animate={swapped ? { x: -d, y: [0, -46, 0], rotate: [-5, 4, 5], scale: [1, 1.07, 1] } : { x: 0, y: 0, rotate: -5, scale: 1 }}
            transition={spring}
            style={{ zIndex: 3 }}
          >
            <MiniCard item={a} />
          </motion.div>
          <motion.div
            className="s-swap-slot"
            animate={swapped ? { x: d, y: [0, 46, 0], rotate: [5, -4, -5], scale: [1, 0.93, 1] } : { x: 0, y: 0, rotate: 5, scale: 1 }}
            transition={spring}
            style={{ zIndex: 1 }}
          >
            <MiniCard item={b} />
          </motion.div>
        </motion.div>
      </AnimatePresence>

      <motion.div className="s-swap-core" animate={{ rotate: swapped ? 180 : 0, scale: swapped ? [1, 1.25, 1] : 1 }} transition={{ duration: 0.9, ease: EASE }}>
        <ShoppingBag size={22} />
      </motion.div>

      <AnimatePresence>
        {swapped && (
          <motion.div
            className="s-swap-done"
            initial={{ opacity: 0, y: 14, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ delay: 0.9, type: "spring", stiffness: 400, damping: 22 }}
          >
            <span className="s-swap-check">
              <Check size={13} strokeWidth={3} />
            </span>{" "}
            يوصلك خلال {store.settings.shippingDays} أيام
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Reveal({ children, delay = 0, className, y = 28 }: { children: React.ReactNode; delay?: number; className?: string; y?: number }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-70px" }} transition={{ duration: 0.8, ease: EASE, delay }}>
      {children}
    </motion.div>
  );
}

export function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const c = animate(0, to, { duration: 1.4, ease: EASE, onUpdate: (x) => setV(Math.round(x)) });
    return () => c.stop();
  }, [inView, to]);
  return (
    <span ref={ref} className="num">
      {v}
      {suffix}
    </span>
  );
}

function Word({ children, progress, range }: { children: string; progress: MotionValue<number>; range: [number, number] }) {
  const opacity = useTransform(progress, range, [0.12, 1]);
  return <motion.span style={{ opacity }}>{children} </motion.span>;
}

/** البيان: الكلمات تتضح واحدة واحدة مع التمرير */
function Manifesto({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.45"] });
  const words = text.split(" ");
  return (
    <section className="s-section s-container">
      <p ref={ref} className="s-manifesto">
        {words.map((w, i) => (
          <Word key={i} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]}>
            {w}
          </Word>
        ))}
      </p>
    </section>
  );
}

function Features() {
  const { store } = useStore();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.8", "end 0.6"] });
  const features = store.content.features.slice(0, 3);
  if (!features.length) return null;
  return (
    <section className="s-section s-container" id="why">
      <Reveal>
        <span className="s-eyebrow">ليش {store.name}</span>
        <h2 className="s-h2">{store.tagline || "مختلف من أول طلب."}</h2>
      </Reveal>
      <div className="s-steps" ref={ref}>
        <div className="s-steps-line">
          <motion.span style={{ scaleX: scrollYProgress }} />
        </div>
        {features.map((f, i) => (
          <Reveal key={f.title} delay={i * 0.12} className="s-step">
            <motion.div className="s-step-icon" whileHover={{ rotate: -8, scale: 1.08 }} transition={{ type: "spring", stiffness: 300, damping: 14 }}>
              <Icon name={f.icon} size={26} strokeWidth={1.5} />
            </motion.div>
            <span className="s-step-num">0{i + 1}</span>
            <h3>{f.title}</h3>
            <p>{f.text}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

const CITIES = ["الرياض", "جدة", "مكة", "المدينة", "الدمام", "الخبر", "الطائف", "أبها", "تبوك", "بريدة", "حائل", "جازان", "نجران", "الجبيل", "ينبع", "الأحساء"];

function Bento() {
  const { store, guaranteeDays } = useStore();
  const stat = store.content.stats[0];
  const feature = store.content.features[0];
  return (
    <section className="s-section s-container">
      <Reveal>
        <span className="s-eyebrow">اطلب وأنت مرتاح</span>
        <h2 className="s-h2">
          طلبك مضمون،
          <br />
          من الدفع إلى الباب.
        </h2>
      </Reveal>
      <div className="s-bento">
        <Reveal className="s-tile s-tile-dark s-tile-wide">
          <ShieldCheck size={26} strokeWidth={1.5} />
          <div className="s-tile-big">
            <Counter to={guaranteeDays} /> <small>يوم ضمان</small>
          </div>
          <h3>ضمان زار على كل طلب</h3>
          <p>إذا ما وصلك طلبك أو ما طابق الوصف، تسترد مبلغك كامل. تطلب الاسترداد من صفحة تتبع طلبك بضغطة.</p>
          <div className="s-tile-glow" />
        </Reveal>
        <Reveal className="s-tile" delay={0.08}>
          <ShoppingBag size={26} strokeWidth={1.5} />
          <h3>ادفع بطريقتك</h3>
          <p>مدى، فيزا، Apple Pay، أو قسّمها بدون فوائد مع تابي وتمارا.</p>
        </Reveal>
        <Reveal className="s-tile s-tile-tagged" delay={0.14}>
          <Icon name={feature?.icon ?? "Sparkles"} size={26} strokeWidth={1.5} />
          <h3>{feature?.title ?? store.tagline}</h3>
          <p>{feature?.text ?? store.content.heroText}</p>
          <div className="s-tile-tags">
            {store.content.marquee.slice(1, 5).map((m, i) => (
              <motion.span key={m} className="s-chip" animate={{ y: [0, -5, 0] }} transition={{ duration: 3, delay: i * 0.4, repeat: Infinity, ease: "easeInOut" }}>
                {m}
              </motion.span>
            ))}
          </div>
        </Reveal>
        <Reveal className="s-tile" delay={0.08}>
          <Icon name={store.content.features[1]?.icon ?? "Star"} size={26} strokeWidth={1.5} />
          {stat ? (
            <>
              <div className="s-tile-big !text-[clamp(64px,7vw,104px)]">
                <Counter to={stat.value} /> <small>{stat.unit}</small>
              </div>
              <h3>{stat.label}</h3>
            </>
          ) : (
            <>
              <h3>{store.content.features[1]?.title}</h3>
              <p>{store.content.features[1]?.text}</p>
            </>
          )}
        </Reveal>
        <Reveal className="s-tile s-tile-wide s-tile-cities" delay={0.14}>
          <Truck size={26} strokeWidth={1.5} className="!static mb-3" />
          <h3>نشحن لكل مدن المملكة</h3>
          <p>
            يوصلك خلال {store.settings.shippingDays} أيام عمل
            {store.settings.freeShippingOver > 0 && <> — والشحن مجاني للطلبات فوق {formatAmount(store.settings.freeShippingOver)} ر.س</>}.
          </p>
          <div className="s-marquee s-marquee-sm" aria-hidden>
            <div className="s-marquee-track">
              {[...CITIES, ...CITIES].map((c, i) => (
                <span key={i} className="s-chip">
                  {c}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/** الصفحة الرئيسية للثيم الناعم — نفس تسلسل «حطّها»: واجهة، شريط، بيان، خطوات، بطاقات، بنتو، أرقام، دعوة */
export function SoftHome({ featured, latest, categories, grid }: { featured: ProductCardDTO[]; latest: ProductCardDTO[]; categories: CategoryDTO[]; grid: React.ReactNode }) {
  const { store } = useStore();
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const orbY = useTransform(scrollYProgress, [0, 1], [0, 180]);
  const visualY = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const headline = store.content.headline.length ? store.content.headline : [store.tagline];
  const allStats = store.content.stats;
  const stats = allStats.length >= 4 ? allStats.slice(0, 4) : allStats.slice(0, 2);
  const pool = featured.length >= 2 ? featured : latest;

  return (
    <>
      <section className="s-hero" ref={heroRef}>
        <motion.div className="s-orbs" style={{ y: orbY }} aria-hidden>
          <span className="s-orb s-orb-1" />
          <span className="s-orb s-orb-2" />
          <span className="s-orb s-orb-3" />
        </motion.div>
        <div className="s-container s-hero-grid">
          <div className="s-hero-copy">
            {store.content.announcement && (
              <motion.span className="s-pill" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
                <span className="s-pill-dot" /> {store.content.announcement}
              </motion.span>
            )}
            <Wordmark text={store.name} />
            <h1 className="s-h1 !text-[clamp(34px,5.2vw,68px)]" aria-label={headline.join(" ")}>
              {headline.map((w, i) => (
                <span key={i} className="s-h1-mask" aria-hidden>
                  <motion.span initial={{ y: "110%" }} animate={{ y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.1 + i * 0.09 }}>
                    {w}
                  </motion.span>
                </span>
              ))}
            </h1>
            <motion.p className="s-lead" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE, delay: 0.65 }}>
              {store.content.heroText}
            </motion.p>
            <motion.div className="s-hero-cta" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE, delay: 0.8 }}>
              <SLink href="/shop" className="s-btn s-btn-primary s-btn-lg">
                تسوّق الآن <ArrowLeft size={18} />
              </SLink>
              <a href="#why" className="s-btn s-btn-ghost s-btn-lg">
                ليش {store.name}؟
              </a>
            </motion.div>
          </div>
          <motion.div style={{ y: visualY }} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1, ease: EASE, delay: 0.4 }}>
            <Showcase products={pool} />
          </motion.div>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="s-marquee" aria-label="التصنيفات">
          <div className="s-marquee-track">
            {[...categories, ...categories, ...categories, ...categories].map((c, i) => (
              <SLink key={i} href={`/shop?cat=${c.slug}`} className="s-marquee-item" tabIndex={i >= categories.length ? -1 : 0}>
                <Icon name={c.icon} size={22} strokeWidth={1.6} /> {c.name}
              </SLink>
            ))}
          </div>
        </section>
      )}

      {store.content.manifesto && <Manifesto text={store.content.manifesto} />}
      <Features />

      <section className="s-section s-container" id="best">
        <Reveal className="s-section-head">
          <div>
            <span className="s-eyebrow">معروض الآن</span>
            <h2 className="s-h2">جديد {store.name}.</h2>
          </div>
          <SLink href="/shop" className="s-btn s-btn-ghost">
            كل المنتجات <ArrowLeft size={16} />
          </SLink>
        </Reveal>
        {grid}
      </section>

      <Bento />

      {stats.length > 1 && (
        <section className="s-section s-container">
          <div className={`s-stats ${stats.length === 2 ? "!grid-cols-2" : ""}`}>
            {stats.map((x, i) => (
              <Reveal key={x.label} delay={i * 0.08} className="s-stat">
                <strong>
                  <Counter to={x.value} />
                </strong>
                <span>
                  {x.unit} {x.label}
                </span>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      <section className="s-container">
        <Reveal className="s-cta">
          <div className="s-cta-orbs" aria-hidden>
            <span className="s-orb s-orb-1" />
            <span className="s-orb s-orb-2" />
          </div>
          <h2>{store.content.ctaTitle || "جاهز تطلب؟"}</h2>
          <p>{store.content.ctaText}</p>
          <SLink href="/shop" className="s-btn s-btn-light s-btn-lg">
            ادخل المتجر <ArrowLeft size={18} />
          </SLink>
        </Reveal>
      </section>
    </>
  );
}
