"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { TLink } from "./Transition";

gsap.registerPlugin(ScrollTrigger, useGSAP);

type Col = { title: string; links: { href: string; label: string }[] };

export function Footer({
  cols,
  info,
  socials,
}: {
  cols: Col[];
  info: { email: string; phone: string; crNumber: string; vatNumber: string; tagline: string };
  socials: { label: string; href: string }[];
}) {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      // الحروف العملاقة تصعد من القاع مع التمرير
      gsap.fromTo(
        ".ft-letter",
        { yPercent: 105 },
        {
          yPercent: 0,
          ease: "none",
          stagger: 0.12,
          scrollTrigger: { trigger: ".ft-word", start: "top bottom", end: "bottom bottom", scrub: 0.6 },
        },
      );
    },
    { scope: root },
  );

  return (
    <footer ref={root} className="on-ink relative overflow-hidden bg-ink text-paper">
      <div className="wrap grid gap-12 pb-10 pt-16 md:grid-cols-[1.3fr_2fr] md:pt-24">
        <div className="max-w-md">
          <p className="t-h3">
            لونك. <span className="t-accent text-lime">مزاجك.</span> مشروبك.
          </p>
          <p className="mt-4 text-sm leading-loose text-paper/60">{info.tagline}</p>
          {info.email && (
            <a href={`mailto:${info.email}`} dir="ltr" className="link-draw mt-6 inline-block font-display text-lg font-semibold text-lime">
              {info.email}
            </a>
          )}
          {socials.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-2">
              {socials.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex rounded-full border border-paper/25 px-4 py-2 text-xs transition-colors hover:border-lime hover:bg-lime hover:text-ink"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {cols.map((c) => (
            <nav key={c.title} aria-label={c.title}>
              <h3 className="t-eyebrow mb-4 text-paper/45">{c.title}</h3>
              <ul className="space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.href}>
                    <TLink href={l.href} className="link-draw text-[0.95rem] text-paper/85 hover:text-lime">
                      {l.label}
                    </TLink>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      <div className="wrap flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-t border-paper/15 py-5 text-xs text-paper/55">
        <p>© {new Date().getFullYear()} PUFF SAUDI — جميع الحقوق محفوظة</p>
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          {info.crNumber && (
            <span>
              السجل التجاري <span className="num text-paper/80">{info.crNumber}</span>
            </span>
          )}
          {info.vatNumber && (
            <span>
              الرقم الضريبي <span className="num text-paper/80">{info.vatNumber}</span>
            </span>
          )}
        </div>
        <ul className="flex flex-wrap gap-1.5" aria-label="وسائل الدفع">
          {["مدى", "VISA", "Mastercard", "Apple Pay"].map((m) => (
            <li key={m} className="rounded-md border border-paper/20 px-2 py-1 font-display text-[0.6rem] font-semibold tracking-wide text-paper/70">
              {m}
            </li>
          ))}
        </ul>
      </div>

      <div className="ft-word select-none overflow-hidden" aria-hidden>
        <div dir="ltr" className="t-mega flex justify-center text-[31.5vw] text-lime" style={{ lineHeight: 0.74 }}>
          {"PUFF".split("").map((c, i) => (
            <span key={i} className="ft-letter inline-block will-change-transform">
              {c}
            </span>
          ))}
        </div>
      </div>
    </footer>
  );
}
