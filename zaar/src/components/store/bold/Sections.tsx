"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Art } from "@/components/ui/Art";
import { Icon } from "@/components/ui/Icon";
import { CountUp, Reveal } from "@/components/ui/Reveal";
import { formatAmount } from "@/lib/money";
import type { ProductArt } from "@/lib/types";
import { SLink, useStore } from "../ctx";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/** البيان (من تصميم PUFF): الكلمات تمتلئ بالضوء مع التمرير، ثم أرقام تصعد */
export function BoldManifesto() {
  const root = useRef<HTMLElement>(null);
  const { store } = useStore();
  const { manifesto, accentWords, stats } = store.content;
  const accent = new Set(accentWords);

  useGSAP(
    () => {
      gsap.fromTo(
        ".mf-word",
        { opacity: 0.14 },
        { opacity: 1, ease: "none", stagger: 0.08, scrollTrigger: { trigger: ".mf-text", start: "top 82%", end: "bottom 45%", scrub: 0.5 } },
      );
    },
    { scope: root },
  );
  if (!manifesto) return null;

  return (
    <section ref={root} className="on-ink relative z-10 -mt-10 rounded-t-[2.2rem] bg-ink py-24 text-paper md:-mt-14 md:rounded-t-[3.5rem] md:py-40">
      <div className="wrap">
        <Reveal as="p" className="t-eyebrow mb-8 text-accent md:mb-12">
          ليش {store.name}؟
        </Reveal>
        <p className="mf-text max-w-[24ch] font-display text-[clamp(1.6rem,4.8vw,4.6rem)] font-extrabold leading-[1.5] md:max-w-[28ch] md:leading-[1.36]">
          {manifesto.split(" ").map((w, i) => (
            <span key={i} className={`mf-word inline-block ${accent.has(w.replace(/[.،,!؟:]/g, "")) ? "t-accent font-normal text-accent" : ""}`}>
              {w}&nbsp;
            </span>
          ))}
        </p>
        {stats.length > 0 && (
          <dl className="mt-20 grid grid-cols-2 gap-x-6 gap-y-12 border-t border-paper/15 pt-12 md:mt-32 md:grid-cols-4 md:pt-16">
            {stats.map((s, i) => (
              <Reveal key={s.label} index={i} className="flex flex-col">
                <dd className="order-1 flex items-baseline gap-2">
                  <CountUp to={s.value} className="t-mega text-[clamp(3.2rem,8vw,7.5rem)] text-accent" />
                  <span className="font-display text-sm font-semibold text-paper/70 md:text-lg">{s.unit}</span>
                </dd>
                <dt className="order-2 mt-3 font-display text-base font-bold md:text-xl">{s.label}</dt>
              </Reveal>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}

export type CategoryPanel = {
  slug: string;
  name: string;
  icon: string;
  count: number;
  fromPrice: number;
  bg: string;
  items: { name: string; image: string | null; art: ProductArt }[];
};

/**
 * التصنيفات (من «عائلات» PUFF): على سطح المكتب يتحول التمرير العمودي إلى رحلة أفقية بين اللوحات،
 * وعلى الجوال شريط أفقي يُسحب باللمس.
 */
export function BoldCategories({ panels }: { panels: CategoryPanel[] }) {
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const { store } = useStore();

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(min-width: 1024px) and (prefers-reduced-motion: no-preference)", () => {
        const el = track.current!;
        const distance = () => el.scrollWidth - window.innerWidth;
        if (distance() <= 0) return;
        // الصفحة RTL: اللوحة الأولى على اليمين، فنحرّك الشريط نحو اليمين (قيمة موجبة)
        const tween = gsap.to(el, {
          x: () => distance(),
          ease: "none",
          scrollTrigger: { trigger: root.current, start: "top top", end: () => `+=${distance()}`, pin: true, scrub: 0.8, invalidateOnRefresh: true, anticipatePin: 1 },
        });
        gsap.utils.toArray<HTMLElement>(".fam-panel").forEach((panel) => {
          gsap.fromTo(
            panel.querySelectorAll(".fam-cup"),
            { yPercent: 18, rotate: (i) => (i % 2 ? 6 : -6) },
            { yPercent: 0, rotate: (i) => (i === 1 ? 0 : i ? 5 : -5), ease: "none", stagger: 0.1, scrollTrigger: { trigger: panel, containerAnimation: tween, start: "right 20%", end: "left 80%", scrub: true } },
          );
          gsap.fromTo(
            panel.querySelector(".fam-latin"),
            { xPercent: -14 },
            { xPercent: 14, ease: "none", scrollTrigger: { trigger: panel, containerAnimation: tween, start: "right left", end: "left right", scrub: true } },
          );
        });
      });
    },
    { scope: root, dependencies: [panels.length] },
  );
  if (!panels.length) return null;

  return (
    <section ref={root} aria-label="التصنيفات" className="relative overflow-hidden bg-paper">
      <div ref={track} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto will-change-transform lg:h-[100svh] lg:w-max lg:snap-none lg:overflow-visible">
        <div className="flex w-[78vw] shrink-0 snap-start flex-col justify-end px-[var(--gutter)] py-14 lg:w-[38vw] lg:justify-center lg:py-0">
          <p className="t-eyebrow text-ink/60">التصنيفات</p>
          <h2 className="t-h1 mt-4">
            اختر
            <br />
            <span className="t-accent font-normal">اللي يناسبك.</span>
          </h2>
          <p className="mt-6 flex items-center gap-2 text-sm text-ink/60">
            <span className="lg:hidden">اسحب</span>
            <span className="hidden lg:inline">واصل التمرير</span>
            <ArrowLeft size={16} className="motion-safe:animate-pulse" />
          </p>
        </div>

        {panels.map((p, idx) => (
          <article key={p.slug} className="fam-panel relative flex w-[88vw] shrink-0 snap-center flex-col overflow-hidden p-2 lg:h-full lg:w-[74vw] lg:p-5">
            <div className="relative flex h-full min-h-[34rem] flex-col justify-between overflow-hidden rounded-tile p-6 md:p-10 lg:min-h-0" style={{ backgroundColor: p.bg }}>
              <div
                aria-hidden
                dir="ltr"
                className="fam-latin t-mega t-outline pointer-events-none absolute inset-x-0 top-[6%] select-none whitespace-nowrap text-center text-[30vw] opacity-60 lg:text-[19vw]"
                style={{ ["--stroke" as string]: "rgb(var(--ink) / .3)" }}
              >
                {(store.nameLatin || "ZAAR").toUpperCase()}
              </div>

              <header className="relative flex items-start justify-between">
                <span className="num t-eyebrow rounded-full bg-ink px-3 py-1.5 text-paper">{String(idx + 1).padStart(2, "0")}</span>
                <span className="rounded-full bg-paper/70 px-3 py-1.5 text-xs font-medium backdrop-blur">
                  <span className="num">{p.count}</span> منتج
                </span>
              </header>

              <div className="pointer-events-none relative my-4 flex flex-1 items-end justify-center gap-[3%] lg:absolute lg:inset-y-[18%] lg:left-[4%] lg:my-0 lg:w-[46%] lg:items-center">
                {p.items.map((c, i) => (
                  <div
                    key={i}
                    className={`fam-cup relative aspect-[4/5] overflow-hidden rounded-[1.6rem] shadow-[0_26px_40px_-18px_rgba(11,11,12,0.4)] ring-4 ring-white/50 will-change-transform ${
                      i === 1 ? "z-10 h-[28vh] lg:h-[78%]" : "mt-8 h-[22vh] lg:mt-0 lg:h-[58%]"
                    }`}
                  >
                    <Art image={c.image} art={c.art} alt={c.name} />
                  </div>
                ))}
              </div>

              <div className="relative lg:max-w-[46%]">
                <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-ink text-accent">
                  <Icon name={p.icon} size={22} />
                </span>
                <h3 className="t-h1 !text-[clamp(2rem,4.8vw,4.4rem)]">{p.name}</h3>
                <div className="mt-7 flex flex-wrap items-center gap-4">
                  <SLink href={`/shop?cat=${p.slug}`} className="btn btn-ink">
                    تسوّق {p.name}
                    <ArrowLeft size={17} />
                  </SLink>
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

/** المزايا + بطاقة ضمان زار */
export function BoldFeatures() {
  const { store, guaranteeDays } = useStore();
  const features = store.content.features;
  return (
    <section className="bg-paper pb-20 md:pb-32" aria-label="المزايا">
      <div className="wrap grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {features.slice(0, 3).map((f, i) => (
          <Reveal key={f.title} index={i} className="bg-paper-deep flex min-h-[15rem] flex-col justify-between rounded-tile p-7">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ink text-accent">
              <Icon name={f.icon} size={22} />
            </span>
            <div>
              <h3 className="t-h3 !text-xl">{f.title}</h3>
              <p className="mt-2 text-sm leading-loose text-ink/70">{f.text}</p>
            </div>
          </Reveal>
        ))}
        <Reveal index={3} className="flex min-h-[15rem] flex-col justify-between rounded-tile bg-ink p-7 text-paper">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-on-accent">
            <ShieldCheck size={22} />
          </span>
          <div>
            <h3 className="t-h3 !text-xl">
              مضمون <span className="t-accent text-accent">بضمان زار</span>
            </h3>
            <p className="mt-2 text-sm leading-loose text-paper/70">
              إذا ما وصلك طلبك أو ما طابق الوصف تسترد مبلغك كامل، حتى {guaranteeDays} يومًا بعد الاستلام.
            </p>
            <SLink href="/pages/guarantee" className="link-draw mt-3 inline-block text-sm font-semibold text-accent">
              كيف يشتغل الضمان؟
            </SLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
