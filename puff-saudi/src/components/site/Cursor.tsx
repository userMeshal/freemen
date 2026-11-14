"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

/**
 * مؤشر مخصص يظهر فقط فوق العناصر التي تحمل data-cursor="نص" (مثل بطاقات المنتجات)،
 * فيتحول إلى دائرة ليمونية تحمل الكلمة. لا يستبدل مؤشر النظام في باقي الصفحة.
 */
export function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState("");

  useEffect(() => {
    const el = dot.current;
    if (!el || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const xTo = gsap.quickTo(el, "x", { duration: 0.45, ease: "power3.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.45, ease: "power3.out" });
    let active = false;

    const move = (e: PointerEvent) => {
      xTo(e.clientX);
      yTo(e.clientY);
      const target = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-cursor]");
      const blocked = (e.target as HTMLElement | null)?.closest("[data-cursor-ignore]");
      if (target && !blocked) {
        if (!active) {
          active = true;
          setLabel(target.dataset.cursor || "");
          gsap.to(el, { scale: 1, opacity: 1, duration: 0.5, ease: "expo.out" });
        }
      } else if (active) {
        active = false;
        gsap.to(el, { scale: 0, opacity: 0, duration: 0.35, ease: "expo.out" });
      }
    };
    const hide = () => {
      active = false;
      gsap.to(el, { scale: 0, opacity: 0, duration: 0.2 });
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", hide);
    document.addEventListener("mouseleave", hide);
    window.addEventListener("puff:page-ready", hide);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", hide);
      document.removeEventListener("mouseleave", hide);
      window.removeEventListener("puff:page-ready", hide);
    };
  }, []);

  return (
    <div
      ref={dot}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[120] -ml-11 -mt-11 hidden h-[5.5rem] w-[5.5rem] place-items-center rounded-full bg-lime font-display text-[0.8rem] font-bold text-ink md:grid"
      style={{ transform: "translate3d(-100px,-100px,0) scale(0)", opacity: 0 }}
    >
      {label}
    </div>
  );
}
