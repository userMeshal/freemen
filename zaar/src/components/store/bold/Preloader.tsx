"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { brandUnits } from "../BrandWord";

/**
 * شاشة الافتتاح (من تصميم PUFF): كلمة المتجر تصعد حرفًا حرفًا مع عدّاد، ثم تنكشف الصفحة.
 * تظهر مرة واحدة في الجلسة لكل متجر (السكربت الذي يخفيها في الزيارات التالية في lib/preloader.ts).
 */
export function Preloader({ slug, name, nameLatin }: { slug: string; name: string; nameLatin: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { units, latin } = brandUnits(nameLatin, name);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const done = () => {
      document.documentElement.classList.add("no-preload");
      window.dispatchEvent(new Event("zaar:intro-done"));
    };
    let seen = false;
    try {
      seen = Boolean(sessionStorage.getItem(`zaar-seen:${slug}`));
      sessionStorage.setItem(`zaar-seen:${slug}`, "1");
    } catch {}
    if (seen || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      done();
      return;
    }
    el.style.animation = "none";
    const counter = { v: 0 };
    const num = el.querySelector<HTMLElement>(".pl-num");
    const tl = gsap.timeline({ onComplete: done });
    tl.to(counter, {
      v: 100,
      duration: 1.15,
      ease: "power2.inOut",
      onUpdate: () => {
        if (num) num.textContent = String(Math.round(counter.v)).padStart(3, "0");
      },
    })
      .to(el.querySelectorAll(".pl-word span"), { yPercent: -115, duration: 0.6, stagger: 0.05, ease: "expo.in" }, ">-0.05")
      .to(el, { clipPath: "inset(0% 0% 100% 0%)", duration: 0.8, ease: "expo.inOut" }, ">-0.3")
      .add(() => window.dispatchEvent(new Event("zaar:intro-start")), "<");
    return () => {
      tl.kill();
    };
  }, [slug]);

  return (
    <div id="preloader" ref={ref} aria-hidden style={{ clipPath: "inset(0% 0% 0% 0%)" }}>
      <div className={`pl-word ${latin ? "" : "is-ar"}`} style={latin && units.length > 5 ? { fontSize: `clamp(3rem, ${100 / units.length}vw, 16rem)` } : undefined}>
        {units.map((c, i) => (
          <span key={i} style={{ ["--i" as string]: i }}>
            {c}
          </span>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-[var(--gutter)] font-display text-xs font-medium tracking-[0.2em] text-paper/60">
        <span>{name}</span>
        <span className="pl-num num text-accent">000</span>
      </div>
    </div>
  );
}
