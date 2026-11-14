"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

declare global {
  interface Window {
    __lenis?: Lenis;
  }
}

/**
 * تمرير ناعم على أجهزة الماوس فقط — على الجوال نترك التمرير الأصلي لأنه الأسرع والأكثر سلاسة.
 */
export function SmoothScroll() {
  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ScrollTrigger.config({ ignoreMobileResize: true });
    if (!fine || reduce) return;

    const lenis = new Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
    window.__lenis = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      window.__lenis = undefined;
    };
  }, []);

  return null;
}

/** إيقاف/تشغيل تمرير الصفحة عند فتح القوائم والنوافذ */
export function lockScroll(lock: boolean) {
  if (typeof window === "undefined") return;
  if (window.__lenis) {
    if (lock) window.__lenis.stop();
    else window.__lenis.start();
  }
  document.documentElement.style.overflow = lock ? "hidden" : "";
}
