import type { CSSProperties } from "react";

/** شريط كتابي متحرك لا نهائي (CSS فقط) */
export function Marquee({
  items,
  reverse = false,
  duration = 32,
  className = "",
  itemClassName = "",
}: {
  items: string[];
  reverse?: boolean;
  duration?: number;
  className?: string;
  itemClassName?: string;
}) {
  const row = (hidden: boolean) => (
    <div className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {items.map((t, i) => (
        <span key={i} className={`flex items-center whitespace-nowrap ${itemClassName}`}>
          <span className={/^[A-Za-z0-9 .&•—-]+$/.test(t) ? "" : ""} dir="auto">
            {t}
          </span>
          <span aria-hidden className="mx-[0.6em] inline-block h-[0.32em] w-[0.32em] rotate-45 bg-current" />
        </span>
      ))}
    </div>
  );
  return (
    <div className={`overflow-hidden ${className}`}>
      <div className={`marquee-track ${reverse ? "reverse" : ""}`} style={{ "--marquee-duration": `${duration}s` } as CSSProperties}>
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
