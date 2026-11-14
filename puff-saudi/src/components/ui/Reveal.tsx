"use client";

import { createElement, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/** يضيف is-in عندما يدخل العنصر الشاشة (مرة واحدة) */
function useInView<T extends HTMLElement>(margin = "0px 0px -12% 0px") {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: margin, threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);
  return { ref, inView };
}

type Tag = "h1" | "h2" | "h3" | "p" | "div" | "span";

/**
 * كشف النص كلمة-بكلمة من داخل قناع.
 * العربية تُقسَّم إلى كلمات (لا حروف) حتى لا ينكسر اتصال الحروف؛ اللاتينية يمكن تقسيمها حروفًا عبر by="char".
 */
export function SplitText({
  text,
  as = "div",
  by = "word",
  className,
  delay = 0,
  immediate = false,
  accentWords,
  accentClassName = "t-accent",
}: {
  text: string;
  as?: Tag;
  by?: "word" | "char";
  className?: string;
  delay?: number;
  /** يبدأ فورًا بعد التحميل بدل انتظار التمرير */
  immediate?: boolean;
  /** كلمات تُعرض بخط اللمسة (الرقعة/السيريف المائل) */
  accentWords?: string[];
  accentClassName?: string;
}) {
  const { ref, inView } = useInView<HTMLElement>();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!immediate) return;
    const t = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(t);
  }, [immediate]);

  const lines = text.split("\n");
  let i = 0;
  const children = lines.map((line, li) => {
    const units = by === "char" ? Array.from(line) : line.split(" ").filter(Boolean);
    return (
      <span key={li} className="block" aria-hidden>
        {units.map((u, ui) => {
          const idx = i++;
          const accent = accentWords?.includes(u.replace(/[.،,!؟]/g, ""));
          return (
            <span key={ui} className="sr-line">
              <span style={{ "--i": idx } as CSSProperties} className={accent ? accentClassName : undefined}>
                {u === " " ? " " : u}
              </span>
              {by === "word" && ui < units.length - 1 ? " " : null}
            </span>
          );
        })}
      </span>
    );
  });

  return createElement(
    as,
    {
      ref,
      className: `sr ${inView || ready ? "is-in" : ""} ${className ?? ""}`,
      style: { "--d": `${delay}ms` } as CSSProperties,
      "aria-label": text.replace(/\n/g, " "),
    },
    children,
  );
}

export function Reveal({
  children,
  className,
  delay = 0,
  index = 0,
  as = "div",
  clip = false,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  index?: number;
  as?: Tag | "li" | "section" | "article";
  clip?: boolean;
}) {
  const { ref, inView } = useInView<HTMLElement>();
  return createElement(
    as,
    {
      ref,
      className: `${clip ? "rv-clip" : "rv"} ${inView ? "is-in" : ""} ${className ?? ""}`,
      style: { "--d": `${delay}ms`, "--i": index } as CSSProperties,
    },
    children,
  );
}

/** عدّاد يصعد للرقم عند ظهوره */
export function CountUp({ to, duration = 1600, className }: { to: number; duration?: number; className?: string }) {
  const { ref, inView } = useInView<HTMLSpanElement>("0px 0px -5% 0px");
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      setValue(Math.round(to * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration]);
  return (
    <span ref={ref} className={`num ${className ?? ""}`}>
      {value}
    </span>
  );
}
