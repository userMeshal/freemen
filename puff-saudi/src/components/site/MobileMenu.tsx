"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { TLink } from "./Transition";
import { useUI } from "@/store/ui";
import { lockScroll } from "./SmoothScroll";
import type { NavLink } from "./Header";

const EASE = [0.16, 1, 0.3, 1] as const;

export function MobileMenu({ links, secondary }: { links: NavLink[]; secondary: NavLink[] }) {
  const open = useUI((s) => s.menuOpen);
  const setMenu = useUI((s) => s.setMenu);

  useEffect(() => {
    lockScroll(open);
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      lockScroll(false);
    };
  }, [open, setMenu]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="القائمة"
          className="on-ink fixed inset-0 z-[110] flex flex-col bg-ink text-paper"
          initial={{ clipPath: "circle(0% at calc(100% - 2.2rem) 2.1rem)" }}
          animate={{ clipPath: "circle(150% at calc(100% - 2.2rem) 2.1rem)" }}
          exit={{ clipPath: "circle(0% at calc(100% - 2.2rem) 2.1rem)" }}
          transition={{ duration: 0.75, ease: EASE }}
        >
          <div className="wrap flex h-[var(--header-h)] shrink-0 items-center justify-between">
            <button
              type="button"
              aria-label="إغلاق"
              onClick={() => setMenu(false)}
              className="-ms-2 grid h-11 w-11 place-items-center rounded-full bg-paper/10"
            >
              <X size={22} />
            </button>
            <span dir="ltr" className="font-display text-[1.55rem] font-black tracking-[-0.06em] text-lime">
              PUFF
            </span>
            <span className="w-9" />
          </div>

          <nav className="wrap flex flex-1 flex-col justify-center gap-1 overflow-y-auto py-6" data-lenis-prevent>
            {links.map((l, i) => (
              <div key={l.href} className="overflow-hidden">
                <motion.div
                  initial={{ y: "110%", rotate: 4 }}
                  animate={{ y: 0, rotate: 0 }}
                  exit={{ y: "110%", transition: { duration: 0.25 } }}
                  transition={{ duration: 0.9, ease: EASE, delay: 0.18 + i * 0.06 }}
                  style={{ transformOrigin: "100% 100%" }}
                >
                  <TLink
                    href={l.href}
                    onClick={() => setMenu(false)}
                    className="flex items-baseline justify-between gap-4 py-1.5 font-display text-[clamp(2rem,9.5vw,3.4rem)] font-extrabold leading-[1.25] active:text-lime"
                  >
                    <span>{l.label}</span>
                    {l.latin && (
                      <span dir="ltr" className="t-accent text-[0.42em] font-normal text-paper/50">
                        {l.latin}
                      </span>
                    )}
                  </TLink>
                </motion.div>
              </div>
            ))}
          </nav>

          <motion.div
            className="wrap pb-safe flex flex-wrap gap-x-6 gap-y-2 border-t border-paper/15 pt-5 text-sm text-paper/70"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.55 }}
          >
            {secondary.map((l) => (
              <TLink key={l.href} href={l.href} onClick={() => setMenu(false)} className="py-1.5">
                {l.label}
              </TLink>
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
