"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

/**
 * شاشة الافتتاح: تظهر مرة واحدة في الجلسة. الـ HTML يُرسَل من الخادم (حتى لا يومض المحتوى)،
 * وسكربت صغير في <head> يخفيها فورًا في الزيارات التالية داخل نفس الجلسة.
 */
export const PRELOADER_SCRIPT = `try{if(sessionStorage.getItem('puff-seen')){document.documentElement.classList.add('no-preload')}}catch(e){}`;

export function Preloader() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const done = () => {
      document.documentElement.classList.add("no-preload");
      window.dispatchEvent(new Event("puff:intro-done"));
    };
    let seen = false;
    try {
      seen = Boolean(sessionStorage.getItem("puff-seen"));
      sessionStorage.setItem("puff-seen", "1");
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
      .add(() => window.dispatchEvent(new Event("puff:intro-start")), "<");
    return () => {
      tl.kill();
    };
  }, []);

  return (
    <div id="preloader" ref={ref} aria-hidden style={{ clipPath: "inset(0% 0% 0% 0%)" }}>
      <div className="pl-word">
        {"PUFF".split("").map((c, i) => (
          <span key={i} style={{ ["--i" as string]: i }}>
            {c}
          </span>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-[var(--gutter)] font-display text-xs font-medium tracking-[0.2em] text-paper/60">
        <span>PUFF SAUDI</span>
        <span className="pl-num num text-lime">000</span>
      </div>
    </div>
  );
}
